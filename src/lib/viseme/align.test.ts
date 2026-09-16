import { describe, expect, it } from 'vitest';
import { alignWords } from './align';
import { syllableCues } from './cues';
import { VisemeIndex } from './index';
import data from './data/words.json';

const index = new VisemeIndex(data);
const vis = (w: string) => index.lookup(w, 'loose').visemes;

describe('alignWords', () => {
	it('scores an identical shape sequence as perfect with every word matched', () => {
		const orig = [...vis('bad'), ...vis('men')];
		const a = alignWords(orig, [vis('mad'), vis('ben')]);
		expect(a.score).toBe(1);
		expect(a.perWord).toEqual([1, 1]);
	});

	it('blames the word that breaks the shapes', () => {
		const orig = [...vis('my'), ...vis('boat')];
		const a = alignWords(orig, [vis('my'), vis('feet')]);
		expect(a.perWord[0]).toBe(1);
		expect(a.perWord[1]).toBeLessThan(1);
		expect(a.score).toBeLessThan(1);
	});

	it('handles empty input', () => {
		expect(alignWords([], []).score).toBe(1);
		expect(alignWords(vis('hello'), [])).toEqual({ score: 0, perWord: [] });
	});
});

describe('syllableCues', () => {
	it('counts syllables and marks where the lips press together', () => {
		const c = syllableCues(index, ['maybe', 'school', 'is', 'like', 'your', 'radio']);
		expect(c.syllables).toBe(9);
		expect(c.lips).toEqual([1, 2]);
		expect(syllableCues(index, ['amplifier'])).toEqual({ syllables: 4, lips: [1] });
	});

	it('falls back to spelling for unknown words', () => {
		expect(syllableCues(index, ['dwainosaur']).syllables).toBe(3);
	});
});
