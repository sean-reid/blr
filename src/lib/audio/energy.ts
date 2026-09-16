export type Span = [start: number, end: number];

/** RMS over the given time spans (seconds) across all channels. */
export function rms(channels: Float32Array[], sampleRate: number, spans: Span[]): number {
	let sum = 0;
	let n = 0;
	for (const ch of channels) {
		for (const [from, to] of spans) {
			const a = Math.max(0, Math.floor(from * sampleRate));
			const b = Math.min(ch.length, Math.floor(to * sampleRate));
			for (let i = a; i < b; i++) sum += ch[i] * ch[i];
			n += Math.max(0, b - a);
		}
	}
	return n ? Math.sqrt(sum / n) : 0;
}

/** Level difference in dB between two sets of spans of the same signal. */
export function spanRatioDb(
	channels: Float32Array[],
	sampleRate: number,
	numerator: Span[],
	denominator: Span[]
): number {
	return (
		20 * Math.log10(rms(channels, sampleRate, numerator) / rms(channels, sampleRate, denominator))
	);
}
