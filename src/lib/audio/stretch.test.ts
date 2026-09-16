import { describe, expect, it } from 'vitest';
import { fitRatio, stretch } from './stretch';

const RATE = 24000;

function sine(freq: number, seconds: number): Float32Array {
	const n = Math.round(seconds * RATE);
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / RATE);
	return out;
}

function zeroCrossings(x: Float32Array): number {
	let n = 0;
	for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 !== x[i] < 0) n++;
	return n;
}

function rms(x: Float32Array): number {
	let s = 0;
	for (const v of x) s += v * v;
	return Math.sqrt(s / x.length);
}

describe('stretch', () => {
	it('changes length by the ratio and keeps pitch', () => {
		const tone = sine(200, 1);
		for (const ratio of [0.8, 1.25]) {
			const out = stretch(tone, ratio, RATE);
			expect(out.length).toBe(Math.round(tone.length * ratio));
			const zcPerSecond = zeroCrossings(out) / (out.length / RATE);
			expect(zcPerSecond).toBeGreaterThan(380);
			expect(zcPerSecond).toBeLessThan(420);
			expect(rms(out)).toBeGreaterThan(rms(tone) * 0.8);
		}
	});

	it('returns a copy for a ratio of one', () => {
		const tone = sine(300, 0.2);
		const out = stretch(tone, 1, RATE);
		expect(out).not.toBe(tone);
		expect(Array.from(out.slice(0, 50))).toEqual(Array.from(tone.slice(0, 50)));
	});
});

describe('fitRatio', () => {
	it('bounds the ratio to the speech-safe range', () => {
		expect(fitRatio(2, 2)).toBe(1);
		expect(fitRatio(2, 3)).toBe(1.25);
		expect(fitRatio(2, 1)).toBe(0.8);
		expect(fitRatio(0, 1)).toBe(1);
	});
});
