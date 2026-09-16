import { describe, expect, it } from 'vitest';
import { clampRange, fmtClock, initialRange } from './range';

describe('range', () => {
	it('starts with the first three minutes only when the video is longer', () => {
		expect(initialRange(120)).toBeNull();
		expect(initialRange(400)).toEqual({ start: 0, end: 180 });
	});

	it('keeps the window inside the video and under the maximum', () => {
		expect(clampRange({ start: 10, end: 400 }, 300)).toEqual({ start: 10, end: 190 });
		expect(clampRange({ start: -5, end: 50 }, 300)).toEqual({ start: 0, end: 50 });
		expect(clampRange({ start: 290, end: 290 }, 300)).toEqual({ start: 290, end: 291 });
		expect(clampRange({ start: 299.5, end: 400 }, 300)).toEqual({ start: 299.5, end: 300 });
	});

	it('formats clock times', () => {
		expect(fmtClock(0)).toBe('0:00');
		expect(fmtClock(185.7)).toBe('3:05');
	});
});
