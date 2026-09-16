import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { spanRatioDb, type Span } from '../src/lib/audio/energy.ts';
import { decodeWav, encodeWav } from '../src/lib/audio/wav.ts';
import { MODEL_URL, RUNTIME_URL } from '../src/lib/audio/separate/config.ts';

export const MODEL = process.env.BLR_MODEL ?? '/tmp/blr-models/Kim_Vocal_2.onnx';
export const CLIP = process.env.BLR_CLIP ?? '/tmp/blr-clips/shy-demo.wav';
export const CLIP_SECONDS = 25;

/** Where speech happens in the demo clip, and the quiet gap (mix near -50 dB) used as the reference. */
export const SPEECH: Span[] = [
	[0.4, 2.4],
	[3.1, 8.7],
	[9.5, 13.7],
	[13.9, 20.4],
	[21.0, 23.7]
];
export const GAP: Span = [8.7, 9.5];

const RUNTIME_FILES: Record<string, string> = {
	'ort-wasm-simd-threaded.jsep.wasm': 'application/wasm',
	'ort-wasm-simd-threaded.jsep.mjs': 'text/javascript'
};

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

/** Puts the model and the onnxruntime files into the emulated R2 bucket the preview server reads. */
export function seedModels() {
	const key = (url: string) => url.replace(/^\/models\//, '');
	const files: [string, string, string][] = [[key(MODEL_URL), MODEL, 'application/octet-stream']];
	for (const [file, type] of Object.entries(RUNTIME_FILES)) {
		files.push([
			key(RUNTIME_URL) + file,
			fileURLToPath(import.meta.resolve(`onnxruntime-web/${file}`)),
			type
		]);
	}
	for (const [objectKey, path, type] of files) {
		execFileSync(
			'pnpm',
			[
				'exec',
				'wrangler',
				'r2',
				'object',
				'put',
				`blr-models/${objectKey}`,
				'--file',
				path,
				'--content-type',
				type,
				'--local',
				'-c',
				'wrangler.dev.jsonc'
			],
			{ stdio: 'ignore' }
		);
	}
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
