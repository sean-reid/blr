import { describe, expect, it } from 'vitest';
import { bounds, parseLines, parseRange } from './share';

describe('parseRange', () => {
	it('reads closed, open and suffix byte ranges', () => {
		expect(parseRange('bytes=0-99')).toEqual({ offset: 0, length: 100 });
		expect(parseRange('bytes=500-')).toEqual({ offset: 500 });
		expect(parseRange('bytes=-200')).toEqual({ suffix: 200 });
	});

	it('ignores anything it cannot serve', () => {
		expect(parseRange(null)).toBeNull();
		expect(parseRange('bytes=-')).toBeNull();
		expect(parseRange('bytes=9-1')).toBeNull();
		expect(parseRange('bytes=0-1,5-6')).toBeNull();
		expect(parseRange('items=0-1')).toBeNull();
	});
});

describe('bounds', () => {
	it('clamps to the object size', () => {
		expect(bounds({ offset: 0, length: 100 }, 1000)).toEqual({ start: 0, end: 99 });
		expect(bounds({ offset: 900, length: 500 }, 1000)).toEqual({ start: 900, end: 999 });
		expect(bounds({ offset: 10 }, 1000)).toEqual({ start: 10, end: 999 });
		expect(bounds({ suffix: 100 }, 1000)).toEqual({ start: 900, end: 999 });
		expect(bounds({ suffix: 5000 }, 1000)).toEqual({ start: 0, end: 999 });
	});
});

describe('parseLines', () => {
	const good = { speaker: 0, start: 1, end: 2, original: 'hi', text: 'high' };

	it('accepts well formed lines only', () => {
		expect(parseLines([good])).toEqual([good]);
		expect(parseLines([{ ...good, extra: true }])).toEqual([good]);
		expect(parseLines([])).toBeNull();
		expect(parseLines('nope')).toBeNull();
		expect(parseLines([{ ...good, speaker: 1.5 }])).toBeNull();
		expect(parseLines([{ ...good, end: 0.5 }])).toBeNull();
		expect(parseLines([{ ...good, text: 4 }])).toBeNull();
		expect(parseLines([{ ...good, text: 'x'.repeat(301) }])).toBeNull();
	});
});
