import { describe, expect, it } from 'vitest';
import { phonesToVisemes, syllableCount } from './classes';
import { spellingSyllables, spellingToVisemes } from './spelling';
import { VisemeIndex, editDistance, normalizeWord, similarity } from './index';
import data from './data/words.json';

const index = new VisemeIndex(data);

describe('phonesToVisemes', () => {
	it('maps bilabials, labiodentals and open vowels', () => {
		expect(phonesToVisemes(['P', 'AE1', 'T'], 'strict')).toEqual(['PP', 'EH', 'DD']);
		expect(phonesToVisemes(['F', 'AE1', 'N'], 'strict')).toEqual(['FF', 'EH', 'DD']);
	});

	it('collapses repeated classes', () => {
		expect(phonesToVisemes(['T', 'S', 'AA1'], 'strict')).toEqual(['DD', 'AA']);
	});

	it('merges hidden consonants at the loose level', () => {
		expect(phonesToVisemes(['TH', 'IH1', 'N'], 'loose')).toEqual(['H', 'IH', 'H']);
		expect(phonesToVisemes(['T', 'IH1', 'N'], 'loose')).toEqual(['H', 'IH', 'H']);
	});

	it('treats diphthongs as their onset shape', () => {
		expect(phonesToVisemes(['B', 'AY1'], 'strict')).toEqual(['PP', 'AA']);
		expect(phonesToVisemes(['B', 'OY1'], 'strict')).toEqual(['PP', 'OH']);
	});
});

describe('syllableCount', () => {
	it('counts vowel phones', () => {
		expect(syllableCount(['B', 'AH1', 'JH', 'IH0', 'T'])).toBe(2);
		expect(syllableCount(['S', 'T', 'R', 'EH1', 'NG', 'K', 'TH', 'S'])).toBe(1);
	});
});

describe('spelling fallback', () => {
	it('approximates visemes from letters', () => {
		expect(spellingToVisemes('bop')).toEqual(['PP', 'OH', 'PP']);
		expect(spellingToVisemes('thatch')).toEqual(['TH', 'AA', 'CH']);
		expect(spellingToVisemes('phone')).toEqual(['FF', 'OH', 'DD']);
	});

	it('estimates syllables', () => {
		expect(spellingSyllables('dwainosaur')).toBe(3);
		expect(spellingSyllables('cake')).toBe(1);
	});
});

describe('normalizeWord', () => {
	it('lowercases and strips punctuation but keeps inner apostrophes', () => {
		expect(normalizeWord("Don't,")).toBe("don't");
		expect(normalizeWord('“Hello”')).toBe('hello');
	});
});

describe('editDistance and similarity', () => {
	it('computes Levenshtein over viseme arrays', () => {
		expect(editDistance(['PP', 'AA', 'DD'], ['PP', 'AA', 'DD'])).toBe(0);
		expect(editDistance(['PP', 'AA', 'DD'], ['PP', 'EH', 'DD'])).toBe(1);
		expect(editDistance([], ['PP'])).toBe(1);
		expect(similarity(['PP', 'AA', 'DD'], ['PP', 'EH', 'DD'])).toBeCloseTo(2 / 3);
	});
});

describe('VisemeIndex', () => {
	it('loads a frequency-ordered dictionary', () => {
		expect(index.entries.length).toBeGreaterThan(30_000);
		expect(index.entries[0].word).toBe('the');
		expect(index.entry('the')?.phones).toEqual(['DH', 'AH']);
	});

	it('looks up dictionary and out-of-dictionary words', () => {
		expect(index.lookup('bat', 'strict')).toEqual({
			visemes: ['PP', 'EH', 'DD'],
			syllables: 1,
			inDictionary: true
		});
		expect(index.lookup('Dwainosaur', 'strict').inDictionary).toBe(false);
		expect(index.lookup('Dwainosaur', 'strict').visemes.length).toBeGreaterThan(2);
	});

	it('returns exact mouth-shape matches first, never the word itself or a homophone', () => {
		const c = index.candidates('bat', 'strict', { limit: 500 });
		const words = c.map((x) => x.word);
		expect(words).toContain('mat');
		expect(words).toContain('pat');
		expect(words).not.toContain('bat');
		expect(c[0].score).toBe(1);
		const two = index.candidates('two', 'strict').map((x) => x.word);
		expect(two).not.toContain('too');
		expect(two).not.toContain('to');
	});

	it('finds more candidates at the loose level', () => {
		const strict = index.candidates('thin', 'strict', { limit: 5000 });
		const loose = index.candidates('thin', 'loose', { limit: 5000 });
		expect(loose.length).toBeGreaterThan(strict.length);
		expect(loose.map((x) => x.word)).toContain('tin');
	});

	it('splits a long word into two when that keeps the shapes', () => {
		const c = index.candidates('budget', 'loose', { limit: 200 });
		expect(c.some((x) => x.word.includes(' '))).toBe(true);
		for (const x of c.filter((x) => x.word.includes(' '))) {
			expect(index.score('budget', x.word, 'loose')).toBe(1);
		}
	});

	it('relaxes to near matches when exact ones run out', () => {
		const c = index.candidates('strengths', 'strict', { limit: 10 });
		expect(c.length).toBeGreaterThan(0);
		expect(c.every((x) => x.score > 0 && x.score <= 1)).toBe(true);
	});

	it('drops tagged profanity when clean is set', () => {
		expect(index.entry('damn')?.profane).toBe(true);
		const all = index.candidates('lamb', 'strict', { limit: 500 }).map((x) => x.word);
		const clean = index
			.candidates('lamb', 'strict', { limit: 500, clean: true })
			.map((x) => x.word);
		expect(all).toContain('damn');
		expect(clean).not.toContain('damn');
	});

	it('scores a replacement phrase against the original', () => {
		expect(index.score('bat', 'mat', 'strict')).toBe(1);
		expect(index.score('bat', 'cat', 'strict')).toBeLessThan(1);
		expect(index.score('bat', 'cat', 'strict')).toBeGreaterThan(0.5);
	});
});
