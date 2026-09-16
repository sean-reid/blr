import { describe, expect, it } from 'vitest';
import { frameCount, hannPeriodic, istft, stft } from './stft.ts';

const cfg = { nFft: 7680, hop: 1024 };

function random(n: number, seed: number): Float32Array {
	const out = new Float32Array(n);
	let s = seed;
	for (let i = 0; i < n; i++) {
		s = (s * 1664525 + 1013904223) >>> 0;
		out[i] = s / 2 ** 31 - 1;
	}
	return out;
}

function maxAbsDiff(a: Float32Array, b: Float32Array): number {
	let m = 0;
	for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
	return m;
}

describe('hannPeriodic', () => {
	it('starts at zero and is symmetric about n/2', () => {
		const w = hannPeriodic(8);
		expect(w[0]).toBe(0);
		expect(w[4]).toBeCloseTo(1, 12);
		expect(w[1]).toBeCloseTo(w[7], 12);
		expect(w[3]).toBeCloseTo(w[5], 12);
	});
});

describe('stft', () => {
	it('produces one frame per hop plus one, keeping all bins up to nyquist', () => {
		const length = 1024 * 255;
		const spec = stft(new Float32Array(length), cfg);
		expect(spec.frames).toBe(256);
		expect(spec.frames).toBe(frameCount(length, cfg.hop));
		expect(spec.bins).toBe(3841);
		expect(spec.re.length).toBe(3841 * 256);
	});

	it('puts a sine at its bin', () => {
		const length = 1024 * 63;
		const bin = 300;
		const freq = (bin * 44100) / cfg.nFft;
		const x = new Float32Array(length);
		for (let i = 0; i < length; i++) x[i] = Math.sin((2 * Math.PI * freq * i) / 44100);
		const spec = stft(x, cfg);
		const t = 30;
		const mag = (f: number) =>
			Math.hypot(spec.re[f * spec.frames + t], spec.im[f * spec.frames + t]);
		expect(mag(bin)).toBeCloseTo(cfg.nFft / 4, 0);
		expect(mag(bin + 10)).toBeLessThan(1e-3 * mag(bin));
	});
});

describe('istft', () => {
	it('round-trips random noise within 1e-4', () => {
		const x = random(1024 * 255, 7);
		const y = istft(stft(x, cfg), cfg);
		expect(y.length).toBe(x.length);
		expect(maxAbsDiff(x, y)).toBeLessThan(1e-4);
	});

	it('round-trips a sine within 1e-4', () => {
		const length = 1024 * 100;
		const x = new Float32Array(length);
		for (let i = 0; i < length; i++) x[i] = 0.8 * Math.sin((2 * Math.PI * 440 * i) / 44100);
		const y = istft(stft(x, cfg), cfg);
		expect(maxAbsDiff(x, y)).toBeLessThan(1e-4);
	});

	it('treats missing high bins as zero', () => {
		const x = random(1024 * 31, 9);
		const full = stft(x, cfg);
		const kept = 3072;
		const truncated = {
			re: full.re.subarray(0, kept * full.frames),
			im: full.im.subarray(0, kept * full.frames),
			bins: kept,
			frames: full.frames
		};
		const zeroed = {
			re: full.re.slice(),
			im: full.im.slice(),
			bins: full.bins,
			frames: full.frames
		};
		zeroed.re.fill(0, kept * full.frames);
		zeroed.im.fill(0, kept * full.frames);
		expect(maxAbsDiff(istft(truncated, cfg), istft(zeroed, cfg))).toBeLessThan(1e-6);
	});
});
