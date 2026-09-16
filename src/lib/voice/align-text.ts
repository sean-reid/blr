import { spellingSyllables } from './syllables';

export interface AlignedWord {
	word: string;
	start: number;
	end: number;
}

const clean = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');

// Returns the spoken span of every word in `text`. When the recogniser's
// words do not line up with the text, the words are spread over the audio
// in proportion to their syllables instead.
export function alignToText(
	text: string,
	heard: { word: string; start: number; end: number }[],
	duration: number
): AlignedWord[] {
	const words = text.split(/\s+/).filter(Boolean);
	const matches =
		heard.length === words.length && heard.every((h, i) => clean(h.word) === clean(words[i]));
	if (matches) return heard.map((h, i) => ({ word: words[i], start: h.start, end: h.end }));
	const counts = words.map(spellingSyllables);
	const total = counts.reduce((a, b) => a + b, 0);
	let t = 0;
	return words.map((word, i) => {
		const span = (duration * counts[i]) / total;
		const out = { word, start: t, end: t + span };
		t += span;
		return out;
	});
}
