import { istft, stft, type Spectrogram } from './stft.ts';

export interface MdxParams {
	nFft: number;
	hop: number;
	dimF: number;
	dimT: number;
	compensate: number;
}

export const KIM_VOCAL_2: MdxParams = {
	nFft: 7680,
	hop: 1024,
	dimF: 3072,
	dimT: 256,
	compensate: 1.009
};

export const SAMPLE_RATE = 44100;
export const DEFAULT_OVERLAP = 0.25;

/** Peak level the mix is scaled to before inference, matching UVR's normalization target. */
export const TARGET_PEAK = 0.9;

export type Stereo = [Float32Array, Float32Array];

export interface ModelRunner {
	run(input: Float32Array): Promise<Float32Array>;
}

export interface ChunkPlan {
	chunkSize: number;
	trim: number;
	step: number;
	paddedLength: number;
	starts: number[];
}

export interface DemixOptions {
	overlap?: number;
	onProgress?: (done: number, total: number) => void;
	signal?: AbortSignal;
}

export interface Stems {
	instrumental: Stereo;
	vocals: Stereo;
}

export function inputSize(p: MdxParams): number {
	return 4 * p.dimF * p.dimT;
}

export function planChunks(length: number, p: MdxParams, overlap = DEFAULT_OVERLAP): ChunkPlan {
	if (overlap < 0 || overlap >= 1) throw new RangeError('overlap must be in [0, 1)');
	const chunkSize = p.hop * (p.dimT - 1);
	const trim = p.nFft >> 1;
	const genSize = chunkSize - 2 * trim;
	const pad = genSize + trim - (length % genSize);
	const paddedLength = trim + length + pad;
	const step = Math.floor((1 - overlap) * chunkSize);
	const starts: number[] = [];
	for (let s = 0; s < paddedLength; s += step) starts.push(s);
	return { chunkSize, trim, step, paddedLength, starts };
}

/** Symmetric Hann as numpy.hanning, used to crossfade overlapping chunks. */
export function chunkWindow(n: number): Float64Array {
	const w = new Float64Array(n);
	if (n === 1) {
		w[0] = 1;
		return w;
	}
	for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
	return w;
}

export function padMixture(mix: Stereo, plan: ChunkPlan): Stereo {
	return mix.map((ch) => {
		const out = new Float32Array(plan.paddedLength);
		out.set(ch, plan.trim);
		return out;
	}) as Stereo;
}

export function sliceChunk(padded: Stereo, start: number, chunkSize: number): Stereo {
	return padded.map((ch) => {
		const out = new Float32Array(chunkSize);
		out.set(ch.subarray(start, Math.min(start + chunkSize, ch.length)));
		return out;
	}) as Stereo;
}

/** Packs left and right spectrograms as [left re, left im, right re, right im] over the first dimF bins. */
export function packInput(left: Spectrogram, right: Spectrogram, p: MdxParams): Float32Array {
	const plane = p.dimF * p.dimT;
	if (left.frames !== p.dimT || right.frames !== p.dimT) {
		throw new Error(`expected ${p.dimT} frames, got ${left.frames} and ${right.frames}`);
	}
	const out = new Float32Array(4 * plane);
	out.set(left.re.subarray(0, plane), 0);
	out.set(left.im.subarray(0, plane), plane);
	out.set(right.re.subarray(0, plane), 2 * plane);
	out.set(right.im.subarray(0, plane), 3 * plane);
	const dc = 3 * p.dimT;
	for (let c = 0; c < 4; c++) out.fill(0, c * plane, c * plane + dc);
	return out;
}

export function unpackOutput(out: Float32Array, p: MdxParams): [Spectrogram, Spectrogram] {
	const plane = p.dimF * p.dimT;
	if (out.length !== 4 * plane) throw new Error(`expected ${4 * plane} values, got ${out.length}`);
	const spec = (re: number, im: number): Spectrogram => ({
		re: out.subarray(re * plane, (re + 1) * plane),
		im: out.subarray(im * plane, (im + 1) * plane),
		bins: p.dimF,
		frames: p.dimT
	});
	return [spec(0, 1), spec(2, 3)];
}

export function peak(mix: Stereo): number {
	let m = 0;
	for (const ch of mix) for (let i = 0; i < ch.length; i++) m = Math.max(m, Math.abs(ch[i]));
	return m;
}

export function scaled(mix: Stereo, gain: number): Stereo {
	return mix.map((ch) => ch.map((v) => v * gain)) as Stereo;
}

/** Runs the model over overlapping chunks and returns the primary stem at the mix's length. */
export async function demix(
	mix: Stereo,
	runner: ModelRunner,
	p: MdxParams,
	{ overlap = DEFAULT_OVERLAP, onProgress, signal }: DemixOptions = {}
): Promise<Stereo> {
	const length = mix[0].length;
	if (mix[1].length !== length) throw new Error('channels differ in length');
	const plan = planChunks(length, p, overlap);
	const padded = padMixture(mix, plan);
	const stftCfg = { nFft: p.nFft, hop: p.hop };
	const acc: [Float64Array, Float64Array] = [
		new Float64Array(plan.paddedLength),
		new Float64Array(plan.paddedLength)
	];
	const divider = new Float64Array(plan.paddedLength);

	for (let c = 0; c < plan.starts.length; c++) {
		signal?.throwIfAborted();
		const start = plan.starts[c];
		const end = Math.min(start + plan.chunkSize, plan.paddedLength);
		const actual = end - start;
		const chunk = sliceChunk(padded, start, plan.chunkSize);
		const input = packInput(stft(chunk[0], stftCfg), stft(chunk[1], stftCfg), p);
		const [outL, outR] = unpackOutput(await runner.run(input), p);
		const waves = [istft(outL, stftCfg), istft(outR, stftCfg)];
		const window = overlap > 0 ? chunkWindow(actual) : null;
		for (let ch = 0; ch < 2; ch++) {
			for (let i = 0; i < actual; i++) {
				const w = window ? window[i] : 1;
				acc[ch][start + i] += waves[ch][i] * w;
				if (ch === 0) divider[start + i] += w;
			}
		}
		onProgress?.(c + 1, plan.starts.length);
	}

	return acc.map((a) => {
		const out = new Float32Array(length);
		for (let i = 0; i < length; i++) {
			const d = divider[plan.trim + i];
			out[i] = d > 0 ? a[plan.trim + i] / d : 0;
		}
		return out;
	}) as Stereo;
}

export async function separateStems(
	mix: Stereo,
	runner: ModelRunner,
	p: MdxParams,
	options: DemixOptions = {}
): Promise<Stems> {
	const level = peak(mix);
	const gain = level > 0 ? TARGET_PEAK / level : 1;
	const vocals = scaled(await demix(scaled(mix, gain), runner, p, options), 1 / gain);
	const instrumental = mix.map((ch, c) => {
		const v = vocals[c];
		const out = new Float32Array(ch.length);
		for (let i = 0; i < ch.length; i++) out[i] = ch[i] - v[i] * p.compensate;
		return out;
	}) as Stereo;
	return { instrumental, vocals };
}
