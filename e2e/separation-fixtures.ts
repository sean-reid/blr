import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { spanRatioDb, type Span } from '../src/lib/audio/energy.ts';
import { decodeWav, encodeWav } from '../src/lib/audio/wav.ts';

export const MODEL = process.env.BLR_MODEL ?? '/tmp/blr-models/Kim_Vocal_2.onnx';
export const CLIP = process.env.BLR_CLIP ?? '/tmp/blr-clips/shy-demo.wav';
export const CLIP_SECONDS = 25;

/** Where speech happens in the demo clip, and the near-silent gap used as the reference. */
export const SPEECH: Span[] = [
	[0.4, 2.4],
	[3.1, 8.7],
	[9.5, 13.7],
	[13.9, 20.4],
	[21.0, 23.7]
];
export const GAP: Span = [2.4, 3.1];

const RUNTIME_WASM = fileURLToPath(
	import.meta.resolve('onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm')
);

export function fixturesPresent() {
	return existsSync(MODEL) && existsSync(CLIP);
}

export function speechToGapDb(channels: Float32Array[], sampleRate: number, seconds: number) {
	const spans = SPEECH.filter(([from]) => from < seconds).map(
		([from, to]) => [from, Math.min(to, seconds)] as Span
	);
	return spanRatioDb(channels, sampleRate, spans, [GAP]);
}

export function clipHead(seconds: number) {
	const { sampleRate, channels } = decodeWav(readFileSync(CLIP).buffer as ArrayBuffer);
	const n = Math.floor(seconds * sampleRate);
	return { sampleRate, channels: channels.map((ch) => ch.slice(0, n)) };
}

export function clipFile(seconds: number) {
	const { sampleRate, channels } = clipHead(seconds);
	return {
		name: 'clip.wav',
		mimeType: 'audio/wav',
		buffer: Buffer.from(encodeWav(channels, sampleRate)),
		sampleRate,
		channels
	};
}

/** Serves the model and the onnxruntime binary from local files so nothing leaves the machine. */
export async function serveModel(page: Page) {
	await page.route('**/models/Kim_Vocal_2.onnx', (route) =>
		route.fulfill({ path: MODEL, contentType: 'application/octet-stream' })
	);
	await page.route('**/ort-wasm-simd-threaded.jsep.wasm', (route) =>
		route.fulfill({ path: RUNTIME_WASM, contentType: 'application/wasm' })
	);
}

/** Drives the dev page through one separation and returns when it reports done or an error. */
export async function runSeparation(page: Page, providerLabel: string, seconds: number) {
	const clip = clipFile(seconds);
	await page.getByLabel('Execution provider').selectOption({ label: providerLabel });
	await page.getByLabel('Audio or video file').setInputFiles(clip);
	await page.getByRole('button', { name: 'Separate' }).click();
	return clip;
}

export async function downloadStem(page: Page, stem: 'vocals' | 'instrumental') {
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('link', { name: `Download ${stem}` }).click();
	const download = await downloadPromise;
	return readFileSync(await download.path());
}
