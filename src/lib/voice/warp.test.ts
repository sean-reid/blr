import { describe, expect, it } from 'vitest';
import { speechClock, speechDuration, warpWords } from './warp';
import type { Word } from '../transcript/types';

const w = (start: number, end: number): Word => ({
	word: 'x',
	punctuated: 'x',
	start,
	end,
	confidence: 1,
	speaker: 0
});

describe('speechClock', () => {
	it('skips the gaps between original words', () => {
		const clock = speechClock([w(0, 1), w(2, 3)]);
		expect(clock(0)).toBe(0);
		expect(clock(0.5)).toBe(1);
		expect(clock(0.75)).toBe(2.5);
		expect(clock(1)).toBe(3);
	});
});

describe('warpWords', () => {
	it('spreads two spoken words over three original words with a pause in between', () => {
		const original = [w(10, 10.5), w(10.5, 11), w(12, 13)];
		const targets = warpWords(original, [
			{ start: 0.1, end: 0.6 },
			{ start: 0.7, end: 1.7 }
		]);
		expect(targets[0].start).toBeCloseTo(10, 5);
		expect(targets[0].end).toBeCloseTo(10.667, 2);
		expect(targets[1].start).toBeCloseTo(10.667, 2);
		expect(targets[1].end).toBeCloseTo(13, 5);
	});

	it('keeps a minimum span and handles a single word', () => {
		const targets = warpWords([w(5, 5.4)], [{ start: 0, end: 0.3 }]);
		expect(targets).toEqual([{ start: 5, end: 5.4 }]);
	});

	it('sums speech time without the gaps', () => {
		expect(
			speechDuration([
				{ start: 0, end: 1 },
				{ start: 3, end: 3.5 }
			])
		).toBe(1.5);
	});
});
