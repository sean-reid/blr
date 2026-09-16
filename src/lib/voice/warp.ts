import type { Word } from '../transcript/types';

export interface Span {
	start: number;
	end: number;
}

// Maps a position measured in speech time (gaps removed) back onto the
// clock, so words land where the mouth moves and pause where it pauses.
export function speechClock(words: readonly Span[]): (fraction: number) => number {
	const spans = words.filter((w) => w.end > w.start);
	const total = spans.reduce((n, w) => n + (w.end - w.start), 0);
	return (fraction: number) => {
		if (!spans.length) return 0;
		let remaining = Math.max(0, Math.min(1, fraction)) * total;
		for (const w of spans) {
			const len = w.end - w.start;
			if (remaining <= len) return w.start + remaining;
			remaining -= len;
		}
		return spans[spans.length - 1].end;
	};
}

// Gives every synthesised word a target span on the original's timeline by
// matching cumulative speech time, so a long new line spreads over the whole
// mouth movement and a short one leaves the mouth's pauses silent.
export function warpWords(original: readonly Word[], spoken: readonly Span[]): Span[] {
	const clock = speechClock(original);
	const speechTotal = spoken.reduce((n, w) => n + (w.end - w.start), 0);
	if (speechTotal <= 0) return spoken.map(() => ({ start: clock(0), end: clock(1) }));
	let elapsed = 0;
	return spoken.map((w) => {
		const start = clock(elapsed / speechTotal);
		elapsed += w.end - w.start;
		const end = clock(elapsed / speechTotal);
		return { start, end: Math.max(end, start + 0.05) };
	});
}

export function speechDuration(words: readonly Span[]): number {
	return words.reduce((n, w) => n + Math.max(0, w.end - w.start), 0);
}

export const RUN_GAP = 0.12;

// Merges words separated by less than a real pause into speech runs; the
// mouth only visibly stops between runs.
export function speechRuns(words: readonly Span[], gap = RUN_GAP): Span[] {
	const runs: Span[] = [];
	for (const w of words) {
		const last = runs[runs.length - 1];
		if (last && w.start - last.end < gap) last.end = Math.max(last.end, w.end);
		else runs.push({ start: w.start, end: w.end });
	}
	return runs;
}

export interface RunMap {
	source: Span;
	target: Span;
}

// Splits the spoken words into as many runs as the original has, cutting at
// the word boundaries nearest each run boundary in speech time, so each run
// keeps its natural flow and the voice pauses only where the mouth does.
export function mapRuns(original: readonly Word[], spoken: readonly Span[]): RunMap[] {
	const runs = speechRuns(original);
	if (!runs.length || !spoken.length) return [];
	const count = Math.min(runs.length, spoken.length);
	const merged = count < runs.length ? mergeRuns(runs, count) : runs;
	const total = merged.reduce((n, r) => n + (r.end - r.start), 0);
	const spokenTotal = speechDuration(spoken);
	const cuts: number[] = [0];
	let acc = 0;
	for (let i = 0; i < merged.length - 1; i++) {
		acc += merged[i].end - merged[i].start;
		const fraction = acc / total;
		let best = cuts[cuts.length - 1] + 1;
		let bestDiff = Infinity;
		let elapsed = 0;
		for (let k = 0; k < spoken.length; k++) {
			elapsed += spoken[k].end - spoken[k].start;
			const diff = Math.abs(elapsed / spokenTotal - fraction);
			if (k + 1 > cuts[cuts.length - 1] && k + 1 < spoken.length && diff < bestDiff) {
				bestDiff = diff;
				best = k + 1;
			}
		}
		cuts.push(Math.min(best, spoken.length - (merged.length - 1 - i)));
	}
	cuts.push(spoken.length);
	return merged.map((target, i) => ({
		source: { start: spoken[cuts[i]].start, end: spoken[cuts[i + 1] - 1].end },
		target
	}));
}

function mergeRuns(runs: Span[], count: number): Span[] {
	const out = runs.map((r) => ({ ...r }));
	while (out.length > count) {
		let at = 0;
		let smallest = Infinity;
		for (let i = 0; i < out.length - 1; i++) {
			const gap = out[i + 1].start - out[i].end;
			if (gap < smallest) {
				smallest = gap;
				at = i;
			}
		}
		out[at] = { start: out[at].start, end: out[at + 1].end };
		out.splice(at + 1, 1);
	}
	return out;
}
