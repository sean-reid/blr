import { FFT } from './fft.ts';

export interface StftConfig {
	nFft: number;
	hop: number;
}

/** Complex spectrogram stored bin-major: index = bin * frames + frame. */
export interface Spectrogram {
	re: Float32Array;
	im: Float32Array;
	bins: number;
	frames: number;
}

export function hannPeriodic(n: number): Float64Array {
	const w = new Float64Array(n);
	for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
	return w;
}

export function frameCount(length: number, hop: number): number {
	return 1 + Math.floor(length / hop);
}

function reflectIndex(t: number, length: number): number {
	if (t < 0) t = -t;
	if (t >= length) t = 2 * (length - 1) - t;
	return t;
}

const ffts = new Map<number, FFT>();
function fftFor(n: number): FFT {
	let f = ffts.get(n);
	if (!f) {
		f = new FFT(n);
		ffts.set(n, f);
	}
	return f;
}

/** Centered STFT with reflect padding and a periodic Hann window, matching torch.stft defaults. */
export function stft(signal: Float32Array, { nFft, hop }: StftConfig): Spectrogram {
	const fft = fftFor(nFft);
	const window = hannPeriodic(nFft);
	const pad = nFft >> 1;
	const frames = frameCount(signal.length, hop);
	const bins = pad + 1;
	const re = new Float32Array(bins * frames);
	const im = new Float32Array(bins * frames);
	const bufRe = new Float64Array(nFft);
	const bufIm = new Float64Array(nFft);
	for (let t = 0; t < frames; t++) {
		const start = t * hop - pad;
		for (let i = 0; i < nFft; i++) {
			bufRe[i] = signal[reflectIndex(start + i, signal.length)] * window[i];
		}
		bufIm.fill(0);
		fft.forward(bufRe, bufIm);
		for (let f = 0; f < bins; f++) {
			re[f * frames + t] = bufRe[f];
			im[f * frames + t] = bufIm[f];
		}
	}
	return { re, im, bins, frames };
}

/**
 * Inverse of stft. Bins beyond spec.bins are treated as zero, so a spectrogram
 * truncated in frequency inverts without being padded first.
 */
export function istft(spec: Spectrogram, { nFft, hop }: StftConfig): Float32Array {
	const fft = fftFor(nFft);
	const window = hannPeriodic(nFft);
	const pad = nFft >> 1;
	const { frames } = spec;
	const total = nFft + hop * (frames - 1);
	const acc = new Float64Array(total);
	const env = new Float64Array(total);
	const bufRe = new Float64Array(nFft);
	const bufIm = new Float64Array(nFft);
	const bins = Math.min(spec.bins, pad + 1);
	for (let t = 0; t < frames; t++) {
		bufRe.fill(0);
		bufIm.fill(0);
		for (let f = 0; f < bins; f++) {
			const r = spec.re[f * frames + t];
			const i = spec.im[f * frames + t];
			bufRe[f] = r;
			bufIm[f] = i;
			if (f > 0 && f < pad) {
				bufRe[nFft - f] = r;
				bufIm[nFft - f] = -i;
			}
		}
		bufIm[0] = 0;
		bufIm[pad] = 0;
		fft.inverse(bufRe, bufIm);
		const offset = t * hop;
		for (let i = 0; i < nFft; i++) {
			acc[offset + i] += bufRe[i] * window[i];
			env[offset + i] += window[i] * window[i];
		}
	}
	const length = hop * (frames - 1);
	const out = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		const e = env[pad + i];
		out[i] = e > 1e-11 ? acc[pad + i] / e : 0;
	}
	return out;
}
