import type { NovaResponse } from '$lib/server/ai/types';
import type { Transcript, Word } from './types';

export function normalizeNova(res: NovaResponse, duration: number): Transcript {
	const alt = res.results.channels[0]?.alternatives[0];
	const words: Word[] = (alt?.words ?? []).map((w) => ({
		word: w.word,
		punctuated: w.punctuated_word ?? w.word,
		start: w.start,
		end: w.end,
		confidence: w.confidence,
		speaker: w.speaker ?? 0
	}));
	return { words, duration };
}
