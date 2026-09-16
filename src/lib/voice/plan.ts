import { stripStress } from '../viseme/classes';
import type { VisemeIndex } from '../viseme/index';
import { normalizeWord } from '../viseme/index';
import type { Line } from '../transcript/types';
import { speechRuns } from './warp';

export interface WordPlan {
	pattern: number[];
	lips: number[];
}

const BILABIAL = new Set(['P', 'B', 'M']);

// Turns each run of mouth movement into the number of syllables the voice
// says in that time, so a reading written to the pattern needs no
// stretching, and marks how many words in have a visible lip closure.
export function wordPlan(index: VisemeIndex, line: Line, pace: number): WordPlan {
	const runs = speechRuns(line.words);
	const pattern = runs.map((r) => Math.max(1, Math.round((r.end - r.start) * pace)));
	const lips: number[] = [];
	line.words.forEach((w, i) => {
		const first = index.entry(normalizeWord(w.word))?.phones[0];
		if (first && BILABIAL.has(stripStress(first))) lips.push(i + 1);
	});
	return { pattern, lips };
}

export function totalSyllables(pattern: readonly number[]): number {
	return pattern.reduce((a, b) => a + b, 0);
}
