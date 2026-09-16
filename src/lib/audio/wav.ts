export interface WavData {
	sampleRate: number;
	channels: Float32Array[];
}

const PCM = 1;
const IEEE_FLOAT = 3;
const EXTENSIBLE = 0xfffe;

function tag(view: DataView, offset: number): string {
	return String.fromCharCode(
		view.getUint8(offset),
		view.getUint8(offset + 1),
		view.getUint8(offset + 2),
		view.getUint8(offset + 3)
	);
}

/** Decodes RIFF WAVE with integer PCM (8, 16, 24, 32 bit) or 32-bit float samples. */
export function decodeWav(buffer: ArrayBuffer): WavData {
	const view = new DataView(buffer);
	if (tag(view, 0) !== 'RIFF' || tag(view, 8) !== 'WAVE') throw new Error('Not a WAVE file');
	let format = 0;
	let channelCount = 0;
	let sampleRate = 0;
	let bits = 0;
	let offset = 12;
	while (offset + 8 <= view.byteLength) {
		const id = tag(view, offset);
		const size = view.getUint32(offset + 4, true);
		const body = offset + 8;
		if (id === 'fmt ') {
			format = view.getUint16(body, true);
			channelCount = view.getUint16(body + 2, true);
			sampleRate = view.getUint32(body + 4, true);
			bits = view.getUint16(body + 14, true);
			if (format === EXTENSIBLE) format = view.getUint16(body + 24, true);
		} else if (id === 'data') {
			if (!channelCount) throw new Error('WAVE data chunk before fmt chunk');
			const bytes = bits >> 3;
			const frames = Math.floor(Math.min(size, view.byteLength - body) / (bytes * channelCount));
			const channels = Array.from({ length: channelCount }, () => new Float32Array(frames));
			let p = body;
			for (let i = 0; i < frames; i++) {
				for (let c = 0; c < channelCount; c++) {
					channels[c][i] = readSample(view, p, format, bits);
					p += bytes;
				}
			}
			return { sampleRate, channels };
		}
		offset = body + size + (size & 1);
	}
	throw new Error('WAVE file has no data chunk');
}

function readSample(view: DataView, p: number, format: number, bits: number): number {
	if (format === IEEE_FLOAT) {
		return bits === 64 ? view.getFloat64(p, true) : view.getFloat32(p, true);
	}
	if (format !== PCM) throw new Error(`Unsupported WAVE format ${format}`);
	switch (bits) {
		case 8:
			return (view.getUint8(p) - 128) / 128;
		case 16:
			return view.getInt16(p, true) / 32768;
		case 24: {
			const v = view.getUint8(p) | (view.getUint8(p + 1) << 8) | (view.getInt8(p + 2) << 16);
			return v / 8388608;
		}
		case 32:
			return view.getInt32(p, true) / 2147483648;
		default:
			throw new Error(`Unsupported PCM bit depth ${bits}`);
	}
}

/** Encodes channels as 32-bit float WAVE. */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
	const channelCount = channels.length;
	const frames = channels[0]?.length ?? 0;
	const dataSize = frames * channelCount * 4;
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);
	const write = (offset: number, s: string) => {
		for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
	};
	write(0, 'RIFF');
	view.setUint32(4, 36 + dataSize, true);
	write(8, 'WAVE');
	write(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, IEEE_FLOAT, true);
	view.setUint16(22, channelCount, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * channelCount * 4, true);
	view.setUint16(32, channelCount * 4, true);
	view.setUint16(34, 32, true);
	write(36, 'data');
	view.setUint32(40, dataSize, true);
	let p = 44;
	for (let i = 0; i < frames; i++) {
		for (let c = 0; c < channelCount; c++) {
			view.setFloat32(p, channels[c][i], true);
			p += 4;
		}
	}
	return buffer;
}
