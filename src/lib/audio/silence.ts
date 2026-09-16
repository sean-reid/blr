// Cuts the quiet padding a speech synthesiser leaves around a line, so the
// voice starts and stops with the mouth. Keeps a short ramp on both sides.
export function trimSilence(
	samples: Float32Array,
	rate: number,
	threshold = 0.01,
	keep = 0.02
): Float32Array {
	const window = Math.max(1, Math.round(rate * 0.005));
	const loud = (i: number) => {
		let peak = 0;
		for (let k = i; k < Math.min(samples.length, i + window); k++)
			peak = Math.max(peak, Math.abs(samples[k]));
		return peak > threshold;
	};
	let start = 0;
	while (start < samples.length && !loud(start)) start += window;
	let end = samples.length;
	while (end > start && !loud(Math.max(0, end - window))) end -= window;
	if (start >= end) return samples.slice();
	const pad = Math.round(keep * rate);
	return samples.slice(Math.max(0, start - pad), Math.min(samples.length, end + pad));
}
