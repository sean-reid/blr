import { describe, expect, it } from 'vitest';
import { renderMix } from './render';
import { rms, type Pcm } from '../audio/mix';
import type { Line } from '../transcript/types';

const RATE = 8000;

function line(id: string, start: number, end: number): Line {
	return { id, speaker: 0, start, end, words: [], text: id };
}

describe('renderMix', () => {
	it('ducks the bed under each line and places stretched speech there', () => {
		const bed: Pcm = {
			rate: RATE,
			channels: [new Float32Array(4 * RATE).fill(0.3), new Float32Array(4 * RATE).fill(0.3)]
		};
		const speech = new Float32Array(RATE).map(
			(_, i) => 0.5 * Math.sin((2 * Math.PI * 220 * i) / RATE)
		);
		const out = renderMix(bed, [{ line: line('a', 1, 2.2), samples: speech, rate: RATE }]);
		expect(out.channels.length).toBe(2);
		expect(out.channels[0].length).toBe(4 * RATE);
		expect(rms(out.channels[0], 0, Math.round(0.8 * RATE))).toBeCloseTo(0.3, 2);
		const inside = rms(out.channels[0], Math.round(1.1 * RATE), Math.round(2.0 * RATE));
		expect(inside).toBeGreaterThan(0.2);
		expect(rms(out.channels[0], Math.round(1.1 * RATE), Math.round(2.0 * RATE))).not.toBeCloseTo(
			0.3,
			2
		);
		expect(rms(out.channels[0], Math.round(2.5 * RATE), 4 * RATE)).toBeCloseTo(0.3, 2);
	});
});
