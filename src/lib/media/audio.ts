export const TRANSCRIBE_RATE = 16000;

export async function decodeAudio(file: Blob): Promise<AudioBuffer> {
	const bytes = await file.arrayBuffer();
	const ctx = new AudioContext();
	try {
		return await ctx.decodeAudioData(bytes);
	} finally {
		await ctx.close();
	}
}

export async function toMono(buffer: AudioBuffer, rate: number): Promise<Float32Array> {
	const length = Math.ceil((buffer.duration * rate) / 1) + 1;
	const ctx = new OfflineAudioContext(1, length, rate);
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	src.connect(ctx.destination);
	src.start();
	const out = await ctx.startRendering();
	return out.getChannelData(0);
}

export function encodeWav16(pcm: Float32Array, rate: number): Blob {
	const bytes = new ArrayBuffer(44 + pcm.length * 2);
	const v = new DataView(bytes);
	const ascii = (o: number, s: string) => {
		for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
	};
	ascii(0, 'RIFF');
	v.setUint32(4, 36 + pcm.length * 2, true);
	ascii(8, 'WAVE');
	ascii(12, 'fmt ');
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true);
	v.setUint16(22, 1, true);
	v.setUint32(24, rate, true);
	v.setUint32(28, rate * 2, true);
	v.setUint16(32, 2, true);
	v.setUint16(34, 16, true);
	ascii(36, 'data');
	v.setUint32(40, pcm.length * 2, true);
	let o = 44;
	for (let i = 0; i < pcm.length; i++, o += 2) {
		const s = Math.max(-1, Math.min(1, pcm[i]));
		v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
	}
	return new Blob([bytes], { type: 'audio/wav' });
}
