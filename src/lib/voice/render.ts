import { duck, mix, resample, type Clip, type Pcm } from '../audio/mix';
import { fitRatio, stretch } from '../audio/stretch';
import type { Line } from '../transcript/types';

export interface Spoken {
	line: Line;
	samples: Float32Array;
	rate: number;
}

export function pcmFromBuffer(buffer: AudioBuffer): Pcm {
	const channels = [buffer.getChannelData(0).slice()];
	if (buffer.numberOfChannels > 1) channels.push(buffer.getChannelData(1).slice());
	return { rate: buffer.sampleRate, channels };
}

// Each spoken line is stretched toward its slot, within the speech-safe
// range, then dropped onto the ducked bed at the line's start time.
export function renderMix(bed: Pcm, spoken: Spoken[], duckBed = true): Pcm {
	const spans = spoken.map((s) => ({ start: s.line.start, end: s.line.end }));
	const clips: Clip[] = spoken.map((s) => {
		const mono = resample(s.samples, s.rate, bed.rate);
		const slot = Math.max(0.2, s.line.end - s.line.start);
		const ratio = fitRatio(mono.length / bed.rate, slot);
		return { at: s.line.start, samples: stretch(mono, ratio, bed.rate), gain: 0.9 };
	});
	return mix(duckBed ? duck(bed, spans) : bed, clips);
}

export function toAudioBuffer(ctx: BaseAudioContext, pcm: Pcm): AudioBuffer {
	const buffer = ctx.createBuffer(pcm.channels.length, pcm.channels[0].length, pcm.rate);
	pcm.channels.forEach((ch, i) => buffer.copyToChannel(new Float32Array(ch), i));
	return buffer;
}
