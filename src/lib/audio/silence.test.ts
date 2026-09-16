import { describe, expect, it } from 'vitest';
import { trimSilence } from './silence';

const RATE = 8000;

describe('trimSilence', () => {
	it('removes leading and trailing quiet but keeps a short ramp', () => {
		const s = new Float32Array(RATE * 2);
		for (let i = Math.round(0.5 * RATE); i < Math.round(1.2 * RATE); i++)
			s[i] = 0.5 * Math.sin(i / 7);
		const out = trimSilence(s, RATE);
		const seconds = out.length / RATE;
		expect(seconds).toBeGreaterThan(0.7);
		expect(seconds).toBeLessThan(0.78);
	});

	it('returns a copy of silence untouched', () => {
		const s = new Float32Array(RATE);
		const out = trimSilence(s, RATE);
		expect(out.length).toBe(RATE);
		expect(out).not.toBe(s);
	});
});
