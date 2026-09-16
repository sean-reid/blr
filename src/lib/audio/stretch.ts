export const MIN_RATIO = 0.8;
export const MAX_RATIO = 1.25;

// WSOLA time stretch for speech: ratio > 1 lengthens, < 1 shortens. Pitch is
// preserved because whole waveform periods are repeated or dropped.
export function stretch(input: Float32Array, ratio: number, rate: number): Float32Array {
	if (Math.abs(ratio - 1) < 0.005 || input.length < 64) return input.slice();
	const win = Math.round(rate * 0.03);
	const hop = Math.round(win / 2);
	const tol = Math.round(rate * 0.008);
	const outLen = Math.round(input.length * ratio);
	const out = new Float32Array(outLen + win);
	const norm = new Float32Array(outLen + win);
	const window = hann(win);

	let outPos = 0;
	let prevIn = 0;
	while (outPos + win < out.length) {
		const target = Math.round(outPos / ratio);
		let best = clamp(target, 0, input.length - win);
		if (outPos > 0) {
			const natural = prevIn + hop;
			let bestScore = -Infinity;
			const lo = clamp(target - tol, 0, input.length - win);
			const hi = clamp(target + tol, 0, input.length - win);
			for (let cand = lo; cand <= hi; cand += 4) {
				let score = 0;
				for (let k = 0; k < win; k += 2) score += input[cand + k] * input[natural + k] || 0;
				if (score > bestScore) {
					bestScore = score;
					best = cand;
				}
			}
		}
		for (let k = 0; k < win; k++) {
			out[outPos + k] += input[best + k] * window[k];
			norm[outPos + k] += window[k];
		}
		prevIn = best;
		outPos += hop;
	}
	const result = new Float32Array(outLen);
	for (let i = 0; i < outLen; i++) result[i] = norm[i] > 1e-6 ? out[i] / norm[i] : 0;
	return result;
}

export function fitRatio(source: number, target: number): number {
	if (source <= 0) return 1;
	return Math.min(MAX_RATIO, Math.max(MIN_RATIO, target / source));
}

function hann(n: number): Float32Array {
	const w = new Float32Array(n);
	for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
	return w;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}
