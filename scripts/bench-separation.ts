import { spawn, type ChildProcess } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { decodeWav } from '../src/lib/audio/wav.ts';
import {
	CLIP,
	CLIP_SECONDS,
	MODEL,
	downloadStem,
	fixturesPresent,
	runSeparation,
	serveModel,
	speechToGapDb
} from '../e2e/separation-fixtures.ts';

const OUT = process.env.BLR_OUT ?? '/tmp/blr-sep';
const PORT = Number(process.env.PORT ?? 4173);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const PROVIDERS: { label: string; name: string }[] = [
	{ label: 'WebGPU only', name: 'webgpu' },
	{ label: 'WASM only', name: 'wasm' }
];
const GPU_ARGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--use-angle=metal'];

interface Result {
	provider: string;
	ok: boolean;
	error?: string;
	loadMs?: number;
	separateMs?: number;
	realtime?: number;
	peakHeapMb?: number;
	peakRendererRssMb?: number;
	mixDb?: number;
	vocalDb?: number;
}

async function serverUp(url: string) {
	try {
		return (await fetch(url, { method: 'HEAD' })).ok;
	} catch {
		return false;
	}
}

async function ensureServer(): Promise<ChildProcess | null> {
	if (await serverUp(`${BASE_URL}/dev/separate`)) return null;
	console.log(`starting preview on ${BASE_URL}`);
	const child = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], {
		stdio: 'ignore'
	});
	for (let i = 0; i < 60; i++) {
		await new Promise((r) => setTimeout(r, 1000));
		if (await serverUp(`${BASE_URL}/dev/separate`)) return child;
	}
	child.kill();
	throw new Error(`preview did not come up on ${BASE_URL}; run pnpm build first`);
}

async function launch(headless: boolean): Promise<Browser> {
	return chromium.launch({ channel: 'chromium', headless, args: GPU_ARGS });
}

/** WebGPU only exists in secure contexts, so the probe runs on the served page rather than about:blank. */
async function hasGpuAdapter(browser: Browser) {
	const page = await browser.newPage();
	try {
		await page.goto(`${BASE_URL}/dev/separate`);
		return await page.evaluate(async () => {
			const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
			return !!gpu && (await gpu.requestAdapter()) !== null;
		});
	} finally {
		await page.close();
	}
}

async function rendererRssMb(browser: Browser): Promise<number> {
	try {
		const session = await browser.newBrowserCDPSession();
		const { processInfo } = (await session.send('SystemInfo.getProcessInfo')) as {
			processInfo: { type: string; id: number }[];
		};
		await session.detach();
		const pids = processInfo.filter((p) => p.type === 'renderer').map((p) => String(p.id));
		if (!pids.length) return 0;
		const rows = execFileSync('ps', ['-o', 'rss=', '-p', pids.join(',')], { encoding: 'utf8' });
		return Math.max(
			0,
			...rows
				.split('\n')
				.filter(Boolean)
				.map((r) => Number(r.trim()) / 1024)
		);
	} catch {
		return 0;
	}
}

async function heapMb(page: Page): Promise<number> {
	try {
		const bytes = await page.evaluate(
			() =>
				(performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
					?.usedJSHeapSize ?? 0
		);
		return bytes / 1048576;
	} catch {
		return 0;
	}
}

async function field(page: Page, name: string) {
	return parseFloat((await page.locator(`[data-field=${name}]`).textContent()) ?? 'NaN');
}

async function benchProvider(
	browser: Browser,
	provider: { label: string; name: string }
): Promise<Result> {
	const page = await browser.newPage();
	const result: Result = { provider: provider.name, ok: false };
	try {
		await serveModel(page);
		await page.goto(`${BASE_URL}/dev/separate`);
		const clip = await runSeparation(page, provider.label, CLIP_SECONDS);
		let peakHeap = 0;
		let peakRss = 0;
		const status = page.locator('.status');
		for (;;) {
			const state = await status.getAttribute('data-status');
			if (state === 'done' || state === 'error') break;
			peakHeap = Math.max(peakHeap, await heapMb(page));
			peakRss = Math.max(peakRss, await rendererRssMb(browser));
			await page.waitForTimeout(250);
		}
		result.peakHeapMb = peakHeap;
		result.peakRendererRssMb = peakRss;
		const alerts = await page.getByRole('alert').allTextContents();
		if (alerts.length) {
			result.error = alerts.join(' ');
			return result;
		}
		const used = (await page.locator('[data-field=provider]').textContent())?.trim();
		if (used !== provider.name) {
			result.error = `ran on ${used} instead of ${provider.name}`;
			return result;
		}
		result.loadMs = await field(page, 'loadMs');
		result.separateMs = await field(page, 'separateMs');
		result.realtime = CLIP_SECONDS / (result.separateMs / 1000);

		mkdirSync(OUT, { recursive: true });
		const vocalsWav = await downloadStem(page, 'vocals');
		const instrumentalWav = await downloadStem(page, 'instrumental');
		writeFileSync(join(OUT, `vocals-${provider.name}.wav`), vocalsWav);
		writeFileSync(join(OUT, `instrumental-${provider.name}.wav`), instrumentalWav);
		writeFileSync(join(OUT, 'vocals.wav'), vocalsWav);
		writeFileSync(join(OUT, 'instrumental.wav'), instrumentalWav);

		const vocals = decodeWav(new Uint8Array(vocalsWav).buffer);
		result.mixDb = speechToGapDb(clip.channels, clip.sampleRate, CLIP_SECONDS);
		result.vocalDb = speechToGapDb(vocals.channels, vocals.sampleRate, CLIP_SECONDS);
		result.ok = true;
		return result;
	} catch (err) {
		result.error = err instanceof Error ? err.message : String(err);
		return result;
	} finally {
		await page.close();
	}
}

function report(r: Result) {
	console.log(`\n${r.provider}`);
	if (!r.ok) {
		console.log(`  failed: ${r.error}`);
	} else {
		console.log(`  model load      ${(r.loadMs! / 1000).toFixed(2)} s`);
		console.log(
			`  separation      ${(r.separateMs! / 1000).toFixed(2)} s for ${CLIP_SECONDS} s of audio`
		);
		console.log(`  realtime factor ${r.realtime!.toFixed(2)}x`);
		console.log(
			`  speech/gap      mix ${r.mixDb!.toFixed(1)} dB, vocals ${r.vocalDb!.toFixed(1)} dB`
		);
	}
	console.log(`  peak JS heap    ${r.peakHeapMb?.toFixed(0)} MB on the page thread`);
	console.log(`  peak renderer   ${r.peakRendererRssMb?.toFixed(0)} MB RSS`);
}

if (!fixturesPresent()) {
	console.error(`needs the model at ${MODEL} and the clip at ${CLIP}`);
	process.exit(1);
}

const server = await ensureServer();
let browser = await launch(true);
if (!(await hasGpuAdapter(browser))) {
	console.log('no WebGPU adapter in headless mode, relaunching headed');
	await browser.close();
	browser = await launch(false);
	console.log(`WebGPU adapter available headed: ${await hasGpuAdapter(browser)}`);
}
const results: Result[] = [];
try {
	for (const provider of PROVIDERS) {
		results.push(await benchProvider(browser, provider));
	}
} finally {
	await browser.close();
	server?.kill();
}
for (const r of results) report(r);
console.log(`\nstems written to ${OUT}`);
