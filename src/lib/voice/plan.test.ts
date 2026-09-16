import { describe, expect, it } from 'vitest';
import { totalSyllables, wordPlan } from './plan';
import { VisemeIndex } from '../viseme/index';
import data from '../viseme/data/words.json';
import type { Line } from '../transcript/types';

const index = new VisemeIndex(data);
const word = (text: string, start: number, end: number) => ({
	word: text,
	punctuated: text,
	start,
	end,
	confidence: 1,
	speaker: 0
});

describe('wordPlan', () => {
	it('gives each run of speech the syllables the voice says in that time', () => {
		const line: Line = {
			id: 'l',
			speaker: 0,
			start: 0,
			end: 2.4,
			text: 'back in Morristown maybe',
			words: [
				word('back', 0, 0.25),
				word('in', 0.25, 0.33),
				word('morristown', 0.35, 1.3),
				word('maybe', 1.9, 2.4)
			]
		};
		const plan = wordPlan(index, line, 6);
		expect(plan.pattern).toEqual([8, 3]);
		expect(totalSyllables(plan.pattern)).toBe(11);
		expect(plan.lips).toEqual([1, 3, 4]);
	});
});
