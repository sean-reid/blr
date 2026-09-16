import { describe, expect, it } from 'vitest';
import { encodeWav16 } from './audio';

describe('encodeWav16', () => {
	it('writes a canonical 16-bit mono header', async () => {
		const pcm = new Float32Array([0, 0.5, -0.5, 1, -1]);
		const blob = encodeWav16(pcm, 16000);
		expect(blob.type).toBe('audio/wav');
		const v = new DataView(await blob.arrayBuffer());
		expect(String.fromCharCode(...new Uint8Array(v.buffer, 0, 4))).toBe('RIFF');
		expect(v.getUint16(22, true)).toBe(1);
		expect(v.getUint32(24, true)).toBe(16000);
		expect(v.getUint16(34, true)).toBe(16);
		expect(v.getUint32(40, true)).toBe(10);
		expect(v.getInt16(44, true)).toBe(0);
		expect(v.getInt16(46, true)).toBe(16383);
		expect(v.getInt16(48, true)).toBe(-16384);
		expect(v.getInt16(50, true)).toBe(32767);
		expect(v.getInt16(52, true)).toBe(-32768);
	});
});
