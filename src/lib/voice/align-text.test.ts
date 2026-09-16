import { describe, expect, it } from 'vitest';
import { alignToText } from './align-text';

describe('alignToText', () => {
	it('uses the recogniser timings when they match the text', () => {
		const out = alignToText(
			'My cat is mad',
			[
				{ word: 'my', start: 0.1, end: 0.3 },
				{ word: 'cat', start: 0.3, end: 0.6 },
				{ word: 'is', start: 0.6, end: 0.7 },
				{ word: 'mad.', start: 0.7, end: 1.1 }
			],
			1.2
		);
		expect(out.map((w) => w.start)).toEqual([0.1, 0.3, 0.6, 0.7]);
		expect(out[3].word).toBe('mad');
	});

	it('spreads words by syllables when the recogniser disagrees', () => {
		const out = alignToText('Photosynthesis is fun', [{ word: 'hello', start: 0, end: 1 }], 2);
		expect(out.length).toBe(3);
		expect(out[0].start).toBe(0);
		expect(out[2].end).toBeCloseTo(2, 5);
		expect(out[0].end - out[0].start).toBeGreaterThan(out[1].end - out[1].start);
	});
});
