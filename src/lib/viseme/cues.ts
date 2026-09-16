import { stripStress, VOWELS } from './classes';
import type { VisemeIndex } from './index';

export interface Cues {
	syllables: number;
	lips: number[];
}

const BILABIAL = new Set(['P', 'B', 'M']);

// Finds the syllables where the lips visibly press together, the one mouth
// event a viewer notices even at a distance.
export function syllableCues(index: VisemeIndex, words: readonly string[]): Cues {
	let syllable = 0;
	const lips: number[] = [];
	for (const word of words) {
		const entry = index.entry(word);
		if (!entry) {
			syllable += index.lookup(word, 'strict').syllables;
			continue;
		}
		const phones = entry.phones.map(stripStress);
		for (let i = 0; i < phones.length; i++) {
			const p = phones[i];
			if (VOWELS.has(p)) syllable++;
			if (!BILABIAL.has(p)) continue;
			const onset = VOWELS.has(phones[i + 1] ?? '');
			const at = onset ? syllable + 1 : Math.max(1, syllable);
			if (lips[lips.length - 1] !== at) lips.push(at);
		}
	}
	return { syllables: syllable, lips };
}
