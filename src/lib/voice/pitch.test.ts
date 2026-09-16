import { describe, expect, it } from 'vitest';
import { medianPitch, pickVoices, speakerPitches } from './pitch';
import type { Line } from '../transcript/types';

const RATE = 16000;

function tone(hz: number, seconds: number): Float32Array {
	const out = new Float32Array(Math.round(seconds * RATE));
	for (let i = 0; i < out.length; i++) {
		const t = i / RATE;
		out[i] = 0.4 * Math.sin(2 * Math.PI * hz * t) + 0.2 * Math.sin(2 * Math.PI * 2 * hz * t);
	}
	return out;
}

describe('medianPitch', () => {
	it('finds the fundamental of a harmonic tone', () => {
		const low = medianPitch(tone(110, 1), RATE, [[0, 1]]);
		const high = medianPitch(tone(220, 1), RATE, [[0, 1]]);
		expect(low).toBeGreaterThan(100);
		expect(low).toBeLessThan(120);
		expect(high).toBeGreaterThan(205);
		expect(high).toBeLessThan(235);
	});

	it('returns null for silence', () => {
		expect(medianPitch(new Float32Array(RATE), RATE, [[0, 1]])).toBeNull();
	});
});

describe('speakerPitches and pickVoices', () => {
	it('gives the low speaker a low voice and the high speaker a high one, never the same voice', () => {
		const mono = new Float32Array(2 * RATE);
		mono.set(tone(110, 1), 0);
		mono.set(tone(230, 1), RATE);
		const line = (id: string, speaker: number, start: number, end: number): Line => ({
			id,
			speaker,
			start,
			end,
			words: [{ word: 'x', punctuated: 'x', start, end, confidence: 1, speaker }],
			text: 'x'
		});
		const pitches = speakerPitches(mono, RATE, [line('a', 0, 0, 1), line('b', 1, 1, 2)]);
		const voices = pickVoices(pitches);
		expect(['orion', 'angus', 'zeus']).toContain(voices[0]);
		expect(['luna', 'stella', 'athena']).toContain(voices[1]);
		expect(voices[0]).not.toBe(voices[1]);
	});

	it('alternates when pitch is unknown and never repeats a voice', () => {
		const voices = pickVoices(
			new Map([
				[0, null],
				[1, null],
				[2, 120],
				[3, 120]
			])
		);
		expect(new Set(Object.values(voices)).size).toBe(4);
		expect(voices[0]).toBe('orion');
		expect(voices[1]).toBe('luna');
	});
});
