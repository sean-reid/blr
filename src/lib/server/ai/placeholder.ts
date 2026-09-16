const RATE = 24000;

// A hummed stand-in for speech, roughly 70 ms per character, so the mixing
// and stretching paths see realistic durations for lines without a fixture.
export function placeholderSpeech(text: string): ArrayBuffer {
	const seconds = Math.max(0.3, Math.min(8, text.replace(/\s+/g, '').length * 0.07));
	const n = Math.round(seconds * RATE);
	const bytes = new ArrayBuffer(44 + n * 2);
	const v = new DataView(bytes);
	const ascii = (o: number, s: string) => {
		for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
	};
	ascii(0, 'RIFF');
	v.setUint32(4, 36 + n * 2, true);
	ascii(8, 'WAVE');
	ascii(12, 'fmt ');
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true);
	v.setUint16(22, 1, true);
	v.setUint32(24, RATE, true);
	v.setUint32(28, RATE * 2, true);
	v.setUint16(32, 2, true);
	v.setUint16(34, 16, true);
	ascii(36, 'data');
	v.setUint32(40, n * 2, true);
	for (let i = 0; i < n; i++) {
		const t = i / RATE;
		const env = Math.min(1, i / 400, (n - i) / 400) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t));
		const s =
			0.25 * env * (Math.sin(2 * Math.PI * 140 * t) + 0.5 * Math.sin(2 * Math.PI * 280 * t));
		v.setInt16(44 + i * 2, Math.round(s * 32767), true);
	}
	return bytes;
}
