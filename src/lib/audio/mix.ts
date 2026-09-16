export interface Pcm {
	channels: Float32Array[];
	rate: number;
}

export interface Span {
	start: number;
	end: number;
}

export interface Clip {
	at: number;
	samples: Float32Array;
	gain?: number;
}

export const DUCK_GAIN = 0.12;
export const RAMP = 0.06;

function envelope(length: number, rate: number, spans: Span[], gain: number, ramp: number) {
	const env = new Float32Array(length).fill(1);
	const r = Math.round(ramp * rate);
	for (const s of spans) {
		const a = Math.round(s.start * rate);
		const b = Math.round(s.end * rate);
		for (let i = Math.max(0, a - r); i < Math.min(env.length, b + r); i++) {
			let g = gain;
			if (i < a) g = 1 - (1 - gain) * ((i - (a - r)) / r);
			else if (i >= b) g = gain + (1 - gain) * ((i - b) / r);
			env[i] = Math.min(env[i], g);
		}
	}
	return env;
}

export function duck(bed: Pcm, spans: Span[], gain = DUCK_GAIN, ramp = RAMP): Pcm {
	const env = envelope(bed.channels[0].length, bed.rate, spans, gain, ramp);
	return {
		rate: bed.rate,
		channels: bed.channels.map((ch) => ch.map((v, i) => v * env[i]))
	};
}

export function restore(bed: Pcm, original: Pcm, spans: Span[], ramp = RAMP): Pcm {
	if (!spans.length) return bed;
	const env = envelope(bed.channels[0].length, bed.rate, spans, 0, ramp);
	return {
		rate: bed.rate,
		channels: bed.channels.map((ch, c) => {
			const src = original.channels[c] ?? original.channels[0];
			return ch.map((v, i) => v * env[i] + (src[i] ?? 0) * (1 - env[i]));
		})
	};
}

export function mix(bed: Pcm, clips: Clip[]): Pcm {
	const channels = bed.channels.map((ch) => ch.slice());
	for (const c of clips) {
		const at = Math.round(c.at * bed.rate);
		const g = c.gain ?? 1;
		for (let i = 0; i < c.samples.length; i++) {
			const j = at + i;
			if (j < 0 || j >= channels[0].length) continue;
			for (const ch of channels) ch[j] += c.samples[i] * g;
		}
	}
	let peak = 0;
	for (const ch of channels) for (const v of ch) peak = Math.max(peak, Math.abs(v));
	if (peak > 0.98) {
		const s = 0.98 / peak;
		for (const ch of channels) for (let i = 0; i < ch.length; i++) ch[i] *= s;
	}
	return { rate: bed.rate, channels };
}

export function resample(input: Float32Array, from: number, to: number): Float32Array {
	if (from === to) return input.slice();
	const n = Math.round((input.length * to) / from);
	const out = new Float32Array(n);
	const step = from / to;
	for (let i = 0; i < n; i++) {
		const x = i * step;
		const k = Math.floor(x);
		const f = x - k;
		const a = input[k] ?? 0;
		const b = input[k + 1] ?? a;
		out[i] = a + (b - a) * f;
	}
	return out;
}

export function rms(x: Float32Array, start = 0, end = x.length): number {
	let s = 0;
	for (let i = start; i < end; i++) s += x[i] * x[i];
	return Math.sqrt(s / Math.max(1, end - start));
}
