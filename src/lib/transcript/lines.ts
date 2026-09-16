import type { Line, Transcript, Word } from './types';

export interface LineOptions {
	maxGap?: number;
	maxWords?: number;
	flipWords?: number;
	flipGap?: number;
}

const SENTENCE_END = /[.!?]["')\]]?$/;

// A run of one or two words attributed to a different speaker than both
// neighbours, with no real pause around it, is a diarization slip.
export function smoothSpeakers(words: Word[], flipWords = 2, flipGap = 0.35): Word[] {
	const out = words.map((w) => ({ ...w }));
	const runs: { start: number; end: number }[] = [];
	for (let i = 0; i < out.length;) {
		let j = i;
		while (j < out.length && out[j].speaker === out[i].speaker) j++;
		runs.push({ start: i, end: j });
		i = j;
	}
	const tight = (a: Word, b: Word) => b.start - a.end <= flipGap;
	runs.forEach((run, r) => {
		const len = run.end - run.start;
		if (len > flipWords) return;
		const prev = runs[r - 1];
		const next = runs[r + 1];
		const first = out[run.start];
		const last = out[run.end - 1];
		let speaker: number | null = null;
		if (prev && next && out[prev.start].speaker === out[next.start].speaker) {
			if (tight(out[prev.end - 1], first) && tight(last, out[next.start]))
				speaker = out[prev.start].speaker;
		} else if (
			len === 1 &&
			prev &&
			!next &&
			prev.end - prev.start >= 3 &&
			tight(out[prev.end - 1], first)
		) {
			speaker = out[prev.start].speaker;
		} else if (
			len === 1 &&
			next &&
			!prev &&
			next.end - next.start >= 3 &&
			tight(last, out[next.start])
		) {
			speaker = out[next.start].speaker;
		}
		if (speaker !== null) for (let k = run.start; k < run.end; k++) out[k].speaker = speaker;
	});
	// A sentence-final tail of a run that runs straight into the next speaker
	// belongs to that speaker: "...Morristown. Well, you" | "know, son".
	runs.forEach((run, r) => {
		const next = runs[r + 1];
		if (!next) return;
		let tail = run.end - 1;
		while (tail > run.start && !SENTENCE_END.test(out[tail - 1].punctuated)) tail--;
		const len = run.end - tail;
		if (tail === run.start || len > flipWords) return;
		if (!tight(out[run.end - 1], out[next.start])) return;
		if (SENTENCE_END.test(out[run.end - 1].punctuated)) return;
		for (let k = tail; k < run.end; k++) out[k].speaker = out[next.start].speaker;
	});
	return out;
}

export function groupLines(t: Transcript, opts: LineOptions = {}): Line[] {
	const { maxGap = 0.6, maxWords = 12, flipWords = 2, flipGap = 0.35 } = opts;
	const lines: Line[] = [];
	let cur: Word[] = [];
	const words = smoothSpeakers(t.words, flipWords, flipGap);

	const flush = () => {
		if (!cur.length) return;
		lines.push(toLine(cur, lines.length));
		cur = [];
	};

	for (const w of words) {
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
