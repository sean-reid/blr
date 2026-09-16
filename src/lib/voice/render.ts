import { duck, mix, resample, type Clip, type Pcm } from '../audio/mix';
import { fitRatio, stretch } from '../audio/stretch';
import type { Line } from '../transcript/types';
import { mapRuns, type Span } from './warp';

export interface Spoken {
	line: Line;
	samples: Float32Array;
	rate: number;
	words?: Span[];
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
	const clips: Clip[] = spoken.flatMap((s) => {
		const mono = resample(s.samples, s.rate, bed.rate);
		if (s.words?.length) return runClips(mono, bed.rate, s);
		const slot = Math.max(0.2, s.line.end - s.line.start);
		const ratio = fitRatio(mono.length / bed.rate, slot);
		return [{ at: s.line.start, samples: stretch(mono, ratio, bed.rate), gain: 0.9 }];
	});
	return mix(duckBed ? duck(bed, spans) : bed, clips);
}

// Each run of speech is stretched once toward the run of mouth movement it
// maps to, so words flow inside a run and the voice pauses only where the
// speaker did.
export function runClips(mono: Float32Array, rate: number, s: Spoken): Clip[] {
	return mapRuns(s.line.words, s.words ?? []).map(({ source, target }) => {
		const piece = mono.slice(Math.round(source.start * rate), Math.round(source.end * rate));
		const ratio = fitRatio(piece.length / rate, target.end - target.start, true);
		return { at: target.start, samples: fade(stretch(piece, ratio, rate), rate), gain: 0.9 };
	});
}

function fade(x: Float32Array, rate: number, ms = 8): Float32Array {
	const n = Math.min(Math.round((rate * ms) / 1000), Math.floor(x.length / 2));
	for (let i = 0; i < n; i++) {
		const g = i / n;
		x[i] *= g;
		x[x.length - 1 - i] *= g;
	}
	return x;
}

export function toAudioBuffer(ctx: BaseAudioContext, pcm: Pcm): AudioBuffer {
	const buffer = ctx.createBuffer(pcm.channels.length, pcm.channels[0].length, pcm.rate);
	pcm.channels.forEach((ch, i) => buffer.copyToChannel(new Float32Array(ch), i));
	return buffer;
}
