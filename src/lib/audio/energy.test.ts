import { describe, expect, it } from 'vitest';
import { rms, spanRatioDb } from './energy.ts';

describe('energy', () => {
	const sr = 100;
	const loudThenQuiet = new Float32Array(200);
	loudThenQuiet.fill(1, 0, 100);
	loudThenQuiet.fill(0.1, 100, 200);

	it('measures rms over spans across channels', () => {
		expect(rms([loudThenQuiet], sr, [[0, 1]])).toBeCloseTo(1, 6);
		expect(rms([loudThenQuiet], sr, [[1, 2]])).toBeCloseTo(0.1, 6);
		expect(rms([loudThenQuiet, loudThenQuiet], sr, [[0, 2]])).toBeCloseTo(Math.sqrt(0.505), 6);
		expect(rms([loudThenQuiet], sr, [[5, 6]])).toBe(0);
	});

	it('reports level differences in dB', () => {
		expect(spanRatioDb([loudThenQuiet], sr, [[0, 1]], [[1, 2]])).toBeCloseTo(20, 6);
	});
});
