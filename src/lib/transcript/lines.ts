import type { Line, Transcript, Word } from './types';

export interface LineOptions {
	maxGap?: number;
	maxWords?: number;
}

const SENTENCE_END = /[.!?]["')\]]?$/;

export function groupLines(t: Transcript, opts: LineOptions = {}): Line[] {
	const { maxGap = 0.6, maxWords = 12 } = opts;
	const lines: Line[] = [];
	let cur: Word[] = [];

	const flush = () => {
		if (!cur.length) return;
		lines.push(toLine(cur, lines.length));
		cur = [];
	};

	for (const w of t.words) {
		const prev = cur[cur.length - 1];
		if (prev) {
			const speakerChange = w.speaker !== prev.speaker;
			const gap = w.start - prev.end;
			if (speakerChange || gap > maxGap || cur.length >= maxWords) flush();
		}
		cur.push(w);
		if (SENTENCE_END.test(w.punctuated) && cur.length >= 3) flush();
	}
	flush();
	return lines;
}

function toLine(words: Word[], i: number): Line {
	return {
		id: `l${i}`,
		speaker: words[0].speaker,
		start: words[0].start,
		end: words[words.length - 1].end,
		words,
		text: words.map((w) => w.punctuated).join(' ')
	};
}

export function speakersOf(lines: Line[]): number[] {
	return [...new Set(lines.map((l) => l.speaker))].sort((a, b) => a - b);
}
