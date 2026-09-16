import { describe, expect, it } from 'vitest';
import { decodeWav, encodeWav } from './wav.ts';

describe('wav', () => {
	it('round-trips float32 stereo', () => {
		const left = Float32Array.from([0, 0.5, -0.5, 1, -1]);
		const right = Float32Array.from([0.25, -0.25, 0.125, 0, 0.75]);
		const { sampleRate, channels } = decodeWav(encodeWav([left, right], 44100));
		expect(sampleRate).toBe(44100);
		expect(channels).toHaveLength(2);
		expect(Array.from(channels[0])).toEqual(Array.from(left));
		expect(Array.from(channels[1])).toEqual(Array.from(right));
	});

	it('decodes 16-bit PCM', () => {
		const buffer = new ArrayBuffer(44 + 4);
		const view = new DataView(buffer);
		const write = (o: number, s: string) =>
			[...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
		write(0, 'RIFF');
		view.setUint32(4, 40, true);
		write(8, 'WAVE');
		write(12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, 1, true);
		view.setUint32(24, 8000, true);
		view.setUint32(28, 16000, true);
		view.setUint16(32, 2, true);
		view.setUint16(34, 16, true);
		write(36, 'data');
		view.setUint32(40, 4, true);
		view.setInt16(44, 16384, true);
		view.setInt16(46, -32768, true);
		const { sampleRate, channels } = decodeWav(buffer);
		expect(sampleRate).toBe(8000);
		expect(Array.from(channels[0])).toEqual([0.5, -1]);
	});

	it('rejects non-wave input', () => {
		expect(() => decodeWav(new ArrayBuffer(64))).toThrow(/WAVE/);
	});
});
