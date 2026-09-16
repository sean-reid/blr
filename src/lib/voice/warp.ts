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
