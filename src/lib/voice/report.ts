import type { Line } from '../transcript/types';
import type { Span } from './warp';
import { mapRuns, speechDuration } from './warp';

export interface LineReport {
	id: string;
	text: string;
	originalWords: number;
	spokenWords: number;
	mouthSeconds: number;
	spokenSeconds: number;
	ratio: number;
	runs: { target: number; source: number; stretch: number }[];
}

// Numbers that say how well a spoken reading fits its mouth movement.
export function lineReport(line: Line, text: string, spoken: Span[]): LineReport {
	const mouthSeconds = speechDuration(line.words);
	const spokenSeconds = speechDuration(spoken);
	const runs = mapRuns(line.words, spoken).map(({ source, target }) => {
		const s = source.end - source.start;
		const t = target.end - target.start;
		return { target: round(t), source: round(s), stretch: round(s > 0 ? t / s : 0) };
	});
	return {
		id: line.id,
		text,
		originalWords: line.words.length,
		spokenWords: spoken.length,
		mouthSeconds: round(mouthSeconds),
		spokenSeconds: round(spokenSeconds),
		ratio: round(mouthSeconds > 0 ? spokenSeconds / mouthSeconds : 0),
		runs
	};
}

// Pearson correlation between two energy envelopes sampled every `step`
// seconds over the line, 1 meaning the voice rises and falls with the mouth.
export function envelopeMatch(
	a: Float32Array,
	b: Float32Array,
	rate: number,
	start: number,
	end: number,
	step = 0.02
): number {
	const n = Math.round((end - start) / step);
	if (n < 4) return 0;
	const ea = new Float64Array(n);
	const eb = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const from = Math.round((start + i * step) * rate);
		const to = Math.round((start + (i + 1) * step) * rate);
		ea[i] = rms(a, from, to);
		eb[i] = rms(b, from, to);
	}
	return pearson(ea, eb);
}

function rms(x: Float32Array, from: number, to: number): number {
	let s = 0;
	let n = 0;
	for (let i = Math.max(0, from); i < Math.min(x.length, to); i++) {
		s += x[i] * x[i];
		n++;
	}
	return n ? Math.sqrt(s / n) : 0;
}

function pearson(a: Float64Array, b: Float64Array): number {
	const n = a.length;
	let ma = 0;
	let mb = 0;
	for (let i = 0; i < n; i++) {
		ma += a[i];
		mb += b[i];
	}
	ma /= n;
	mb /= n;
	let num = 0;
	let da = 0;
	let db = 0;
	for (let i = 0; i < n; i++) {
		num += (a[i] - ma) * (b[i] - mb);
		da += (a[i] - ma) ** 2;
		db += (b[i] - mb) ** 2;
	}
	return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

function round(x: number): number {
	return Math.round(x * 100) / 100;
}
