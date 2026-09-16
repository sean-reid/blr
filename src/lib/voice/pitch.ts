import type { Line } from '../transcript/types';

const FRAME = 0.03;
const MIN_HZ = 60;
const MAX_HZ = 400;
const LOW_VOICE_HZ = 165;

export const LOW_VOICES = ['orion', 'angus', 'zeus', 'arcas', 'perseus', 'helios', 'orpheus'];
export const HIGH_VOICES = ['luna', 'stella', 'athena', 'hera', 'asteria'];

// Median fundamental over the voiced frames of a span, by autocorrelation.
export function medianPitch(
	mono: Float32Array,
	rate: number,
	spans: [number, number][]
): number | null {
	const n = Math.round(FRAME * rate);
	const minLag = Math.floor(rate / MAX_HZ);
	const maxLag = Math.ceil(rate / MIN_HZ);
	const pitches: number[] = [];
	for (const [start, end] of spans) {
		for (
			let s = Math.round(start * rate);
			s + n + maxLag < Math.min(mono.length, Math.round(end * rate));
			s += n
		) {
			let energy = 0;
			for (let i = 0; i < n; i++) energy += mono[s + i] * mono[s + i];
			if (energy / n < 1e-4) continue;
			const corr = new Float32Array(maxLag + 1);
			let best = 0;
			for (let lag = minLag; lag <= maxLag; lag++) {
				let sum = 0;
				for (let i = 0; i < n; i++) sum += mono[s + i] * mono[s + i + lag];
				corr[lag] = sum / energy;
				if (corr[lag] > best) best = corr[lag];
			}
			if (best < 0.5) continue;
			// The shortest lag near the maximum is the period; longer ones are its multiples.
			let lag = minLag;
			while (lag <= maxLag && corr[lag] < best * 0.9) lag++;
			while (lag < maxLag && corr[lag + 1] > corr[lag]) lag++;
			pitches.push(rate / lag);
		}
	}
	if (!pitches.length) return null;
	pitches.sort((a, b) => a - b);
	return pitches[Math.floor(pitches.length / 2)];
}

export function speakerPitches(
	mono: Float32Array,
	rate: number,
	lines: Line[]
): Map<number, number | null> {
	const spans = new Map<number, [number, number][]>();
	for (const l of lines) {
		const list = spans.get(l.speaker) ?? [];
		for (const w of l.words) list.push([w.start, w.end]);
		spans.set(l.speaker, list);
	}
	const out = new Map<number, number | null>();
	for (const [speaker, list] of spans) out.set(speaker, medianPitch(mono, rate, list));
	return out;
}

// Low voices for low speakers, high for high, each voice used once; unknown
// pitch alternates so two speakers still sound different.
export function pickVoices(pitches: Map<number, number | null>): Record<number, string> {
	const low = [...LOW_VOICES];
	const high = [...HIGH_VOICES];
	const out: Record<number, string> = {};
	let unknown = 0;
	for (const speaker of [...pitches.keys()].sort((a, b) => a - b)) {
		const hz = pitches.get(speaker);
		const useLow = hz === null || hz === undefined ? unknown++ % 2 === 0 : hz < LOW_VOICE_HZ;
		const pool = useLow ? low : high;
		const other = useLow ? high : low;
		out[speaker] = pool.shift() ?? other.shift() ?? LOW_VOICES[0];
	}
	return out;
}
