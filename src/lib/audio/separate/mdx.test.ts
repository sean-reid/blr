import { describe, expect, it } from 'vitest';
import {
	KIM_VOCAL_2,
	chunkWindow,
	demix,
	inputSize,
	packInput,
	planChunks,
	separateStems,
	unpackOutput,
	type ModelRunner,
	type Stereo
} from './mdx.ts';
import { stft } from './stft.ts';

const p = KIM_VOCAL_2;

function tone(length: number, freqs: number[], amp: number, phase = 0): Float32Array {
	const out = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		let v = 0;
		for (const f of freqs) v += Math.sin((2 * Math.PI * f * i) / 44100 + phase);
		out[i] = (amp * v) / freqs.length;
	}
	return out;
}

function maxAbsDiff(a: Float32Array, b: Float32Array, from = 0, to = a.length): number {
	let m = 0;
	for (let i = from; i < to; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
	return m;
}

/** The band limit rings for half a window where the signal meets the zero padding at each end. */
const EDGE = 4000;

const identity: ModelRunner = { run: async (input) => input.slice() };

describe('planChunks', () => {
	it('uses the UVR chunk geometry for this model', () => {
		const plan = planChunks(44100 * 10, p);
		expect(plan.chunkSize).toBe(1024 * 255);
		expect(plan.trim).toBe(3840);
		expect(plan.step).toBe(Math.floor(0.75 * plan.chunkSize));
		expect(plan.starts[0]).toBe(0);
		expect(plan.starts[1]).toBe(plan.step);
	});

	it('covers every input sample with at least one chunk', () => {
		for (const length of [1, 1000, 44100 * 3, 44100 * 25 + 17]) {
			const plan = planChunks(length, p);
			const covered = new Uint8Array(plan.paddedLength);
			for (const s of plan.starts)
				covered.fill(1, s, Math.min(s + plan.chunkSize, plan.paddedLength));
			expect(plan.paddedLength).toBeGreaterThanOrEqual(plan.trim + length + plan.trim);
			let missed = 0;
			for (let i = plan.trim; i < plan.trim + length; i++) if (!covered[i]) missed++;
			expect(missed).toBe(0);
		}
	});

	it('steps by the whole chunk without overlap', () => {
		const plan = planChunks(44100 * 5, p, 0);
		expect(plan.step).toBe(plan.chunkSize);
	});

	it('rejects overlap outside [0, 1)', () => {
		expect(() => planChunks(100, p, 1)).toThrow(RangeError);
		expect(() => planChunks(100, p, -0.1)).toThrow(RangeError);
	});
});

describe('chunkWindow', () => {
	it('is zero at both ends and one in the middle like numpy.hanning', () => {
		const w = chunkWindow(9);
		expect(w[0]).toBe(0);
		expect(w[8]).toBeCloseTo(0, 12);
		expect(w[4]).toBeCloseTo(1, 12);
		expect(chunkWindow(1)[0]).toBe(1);
	});
});

describe('packInput and unpackOutput', () => {
	it('lays out left re, left im, right re, right im and zeroes the first three bins', () => {
		const chunk = 1024 * (p.dimT - 1);
		const left = stft(tone(chunk, [440], 0.5), { nFft: p.nFft, hop: p.hop });
		const right = stft(tone(chunk, [880], 0.5), { nFft: p.nFft, hop: p.hop });
		const input = packInput(left, right, p);
		expect(input.length).toBe(inputSize(p));
		const plane = p.dimF * p.dimT;
		const bin = 100;
		const t = 40;
		expect(input[bin * p.dimT + t]).toBe(left.re[bin * left.frames + t]);
		expect(input[plane + bin * p.dimT + t]).toBe(left.im[bin * left.frames + t]);
		expect(input[2 * plane + bin * p.dimT + t]).toBe(right.re[bin * right.frames + t]);
		expect(input[3 * plane + bin * p.dimT + t]).toBe(right.im[bin * right.frames + t]);
		for (let c = 0; c < 4; c++) {
			for (let i = 0; i < 3 * p.dimT; i++) expect(input[c * plane + i]).toBe(0);
		}
		const [l, r] = unpackOutput(input, p);
		expect(l.bins).toBe(p.dimF);
		expect(l.re[bin * p.dimT + t]).toBe(left.re[bin * left.frames + t]);
		expect(r.im[bin * p.dimT + t]).toBe(right.im[bin * right.frames + t]);
	});

	it('rejects a chunk with the wrong frame count', () => {
		const spec = stft(new Float32Array(1024 * 10), { nFft: p.nFft, hop: p.hop });
		expect(() => packInput(spec, spec, p)).toThrow(/frames/);
		expect(() => unpackOutput(new Float32Array(10), p)).toThrow(/values/);
	});
});

describe('demix', () => {
	it('reconstructs a band-limited signal through an identity model across chunk seams', async () => {
		const length = 44100 * 8;
		const mix: Stereo = [tone(length, [220, 1000, 5000], 0.6), tone(length, [330, 2500], 0.6, 1)];
		const progress: [number, number][] = [];
		const out = await demix(mix, identity, p, {
			onProgress: (done, total) => progress.push([done, total])
		});
		expect(out[0].length).toBe(length);
		expect(maxAbsDiff(out[0], mix[0], EDGE, length - EDGE)).toBeLessThan(1e-3);
		expect(maxAbsDiff(out[1], mix[1], EDGE, length - EDGE)).toBeLessThan(1e-3);
		expect(maxAbsDiff(out[0], mix[0])).toBeLessThan(5e-2);
		expect(progress.length).toBeGreaterThan(1);
		expect(progress.at(-1)).toEqual([progress.length, progress.length]);
	}, 60000);

	it('feeds the model tensors of the documented size', async () => {
		const sizes: number[] = [];
		const spy: ModelRunner = {
			run: async (input) => {
				sizes.push(input.length);
				return input;
			}
		};
		await demix([new Float32Array(1000), new Float32Array(1000)], spy, p, { overlap: 0 });
		expect(sizes.length).toBeGreaterThan(0);
		expect(sizes.every((s) => s === 4 * 3072 * 256)).toBe(true);
	}, 30000);

	it('stops when aborted', async () => {
		const ctl = new AbortController();
		ctl.abort();
		await expect(
			demix([new Float32Array(1000), new Float32Array(1000)], identity, p, { signal: ctl.signal })
		).rejects.toThrow();
	});
});

describe('separateStems', () => {
	it('returns vocals at the input level and the compensated remainder', async () => {
		const length = 44100 * 2;
		const mix: Stereo = [tone(length, [440], 0.2), tone(length, [660], 0.2)];
		const { vocals, instrumental } = await separateStems(mix, identity, p, { overlap: 0 });
		expect(maxAbsDiff(vocals[0], mix[0], EDGE, length - EDGE)).toBeLessThan(1e-3);
		const expected = mix[1].map((v) => v * (1 - p.compensate));
		expect(maxAbsDiff(instrumental[1], expected, EDGE, length - EDGE)).toBeLessThan(2e-3);
	}, 30000);
});
