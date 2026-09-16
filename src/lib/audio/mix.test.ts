import { describe, expect, it } from 'vitest';
import { duck, mix, resample, restore, rms, type Pcm } from './mix';

const RATE = 1000;

function noise(seconds: number, seed = 1): Float32Array {
	const out = new Float32Array(seconds * RATE);
	let s = seed;
	for (let i = 0; i < out.length; i++) {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		out[i] = (s / 0x7fffffff) * 0.6 - 0.3;
	}
	return out;
}

const bed: Pcm = { rate: RATE, channels: [noise(4), noise(4, 7)] };

describe('duck', () => {
	it('attenuates inside the spans and leaves the rest alone', () => {
		const out = duck(bed, [{ start: 1, end: 2 }]);
		const before = rms(bed.channels[0], 1200, 1800);
		const inside = rms(out.channels[0], 1200, 1800);
		expect(inside / before).toBeCloseTo(0.12, 2);
		expect(rms(out.channels[0], 2500, 3500)).toBeCloseTo(rms(bed.channels[0], 2500, 3500), 5);
		expect(out.channels[0][1000 - 30]).not.toBe(bed.channels[0][1000 - 30]);
	});
});

describe('restore', () => {
	it('brings the original back inside the spans and leaves the rest alone', () => {
		const silent: Pcm = { rate: RATE, channels: [new Float32Array(4 * RATE)] };
		const out = restore(silent, bed, [{ start: 1, end: 2 }]);
		expect(out.channels[0].slice(1200, 1800)).toEqual(bed.channels[0].slice(1200, 1800));
		expect(rms(out.channels[0], 2500, 3500)).toBe(0);
		const edge = out.channels[0][1000 - 30];
		expect(Math.abs(edge)).toBeGreaterThan(0);
		expect(Math.abs(edge)).toBeLessThan(Math.abs(bed.channels[0][1000 - 30]));
		expect(restore(silent, bed, [])).toBe(silent);
	});
});

describe('mix', () => {
	it('adds a clip at its offset to every channel and never clips', () => {
		const clip = new Float32Array(500).fill(0.9);
		const out = mix({ rate: RATE, channels: [new Float32Array(4000), new Float32Array(4000)] }, [
			{ at: 1, samples: clip }
		]);
		expect(out.channels[0][999]).toBe(0);
		expect(out.channels[1][1000]).toBeCloseTo(0.9, 5);
		expect(out.channels[0][1499]).toBeCloseTo(0.9, 5);
		expect(out.channels[0][1500]).toBe(0);
		const loud = mix(bed, [{ at: 0, samples: new Float32Array(4000).fill(0.9) }]);
		expect(Math.max(...loud.channels[0].map(Math.abs))).toBeLessThanOrEqual(0.98);
	});
});

describe('resample', () => {
	it('changes the sample count proportionally and keeps a ramp linear', () => {
		const ramp = new Float32Array(100).map((_, i) => i / 100);
		const out = resample(ramp, 100, 200);
		expect(out.length).toBe(200);
		expect(out[100]).toBeCloseTo(0.5, 2);
		expect(resample(ramp, 100, 100)).not.toBe(ramp);
	});
});
