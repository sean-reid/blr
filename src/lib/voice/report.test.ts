import { describe, expect, it } from 'vitest';
import { envelopeMatch, lineReport } from './report';
import type { Line } from '../transcript/types';

const w = (start: number, end: number) => ({
	word: 'x',
	punctuated: 'x',
	start,
	end,
	confidence: 1,
	speaker: 0
});

describe('lineReport', () => {
	it('reports mouth time, spoken time, their ratio and per-run stretch', () => {
		const line: Line = {
			id: 'l0',
			speaker: 0,
			start: 1,
			end: 3,
			text: 'x x',
			words: [w(1, 1.5), w(2, 3)]
		};
		const r = lineReport(line, 'hi there', [
			{ start: 0, end: 0.5 },
			{ start: 0.6, end: 1.1 }
		]);
		expect(r.mouthSeconds).toBe(1.5);
		expect(r.spokenSeconds).toBe(1);
		expect(r.ratio).toBeCloseTo(0.67, 2);
		expect(r.runs.length).toBe(2);
		expect(r.runs[1].stretch).toBe(2);
	});
});

describe('envelopeMatch', () => {
	it('is high for the same envelope and low for an unrelated one', () => {
		const rate = 1000;
		const a = new Float32Array(2000);
		for (let i = 0; i < 2000; i++) a[i] = i % 400 < 200 ? Math.sin(i) : 0;
		const shifted = new Float32Array(2000);
		for (let i = 0; i < 2000; i++) shifted[i] = i % 400 < 200 ? 0 : Math.sin(i * 1.3);
		expect(envelopeMatch(a, a, rate, 0, 2)).toBeCloseTo(1, 3);
		expect(envelopeMatch(a, shifted, rate, 0, 2)).toBeLessThan(-0.9);
	});
});
