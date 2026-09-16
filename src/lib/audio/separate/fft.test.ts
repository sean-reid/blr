import { describe, expect, it } from 'vitest';
import { FFT } from './fft.ts';

function naiveDft(re: Float64Array, im: Float64Array): [Float64Array, Float64Array] {
	const n = re.length;
	const outRe = new Float64Array(n);
	const outIm = new Float64Array(n);
	for (let k = 0; k < n; k++) {
		let sr = 0;
		let si = 0;
		for (let t = 0; t < n; t++) {
			const a = (-2 * Math.PI * k * t) / n;
			sr += re[t] * Math.cos(a) - im[t] * Math.sin(a);
			si += re[t] * Math.sin(a) + im[t] * Math.cos(a);
		}
		outRe[k] = sr;
		outIm[k] = si;
	}
	return [outRe, outIm];
}

function random(n: number, seed: number): Float64Array {
	const out = new Float64Array(n);
	let s = seed;
	for (let i = 0; i < n; i++) {
		s = (s * 1664525 + 1013904223) >>> 0;
		out[i] = s / 2 ** 31 - 1;
	}
	return out;
}

describe('FFT', () => {
	it.each([2, 8, 15, 30, 60, 240, 7680])('matches a naive DFT for n=%i', (n) => {
		const re = random(n, 1);
		const im = random(n, 2);
		const [expRe, expIm] = naiveDft(re, im);
		const fft = new FFT(n);
		fft.forward(re, im);
		for (let k = 0; k < n; k++) {
			expect(re[k]).toBeCloseTo(expRe[k], 6);
			expect(im[k]).toBeCloseTo(expIm[k], 6);
		}
	});

	it('inverse undoes forward', () => {
		const n = 7680;
		const re = random(n, 3);
		const im = random(n, 4);
		const origRe = re.slice();
		const origIm = im.slice();
		const fft = new FFT(n);
		fft.forward(re, im);
		fft.inverse(re, im);
		let maxErr = 0;
		for (let i = 0; i < n; i++) {
			maxErr = Math.max(maxErr, Math.abs(re[i] - origRe[i]), Math.abs(im[i] - origIm[i]));
		}
		expect(maxErr).toBeLessThan(1e-9);
	});

	it('rejects sizes with other prime factors', () => {
		expect(() => new FFT(7)).toThrow(/factor/);
	});
});
