import {
	ALL_FORMATS,
	AudioBufferSource,
	BlobSource,
	BufferTarget,
	Conversion,
	Input,
	Mp4OutputFormat,
	Output,
	QUALITY_HIGH
} from 'mediabunny';
import type { Pcm } from '$lib/audio/mix';

export interface RemuxResult {
	blob: Blob;
	video: boolean;
}

// Copies the video track as-is and writes the new mix as the only audio
// track, so export costs an audio encode and nothing else.
export async function remux(
	file: Blob,
	mixed: Pcm,
	onProgress?: (p: number) => void
): Promise<RemuxResult> {
	const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
	const output = new Output({
		format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
		target: new BufferTarget()
	});
	const conversion = await Conversion.init({
		input,
		output,
		video: {},
		audio: { discard: true },
		composable: true,
		showWarnings: false
	});
	conversion.onProgress = (p) => onProgress?.(p);
	const audio = new AudioBufferSource({ codec: 'aac', bitrate: QUALITY_HIGH });
	output.addAudioTrack(audio);
	await output.start();
	const buffer = toAudioBuffer(mixed);
	await Promise.all([conversion.execute(), audio.add(buffer).then(() => audio.close())]);
	await output.finalize();
	const bytes = output.target.buffer;
	if (!bytes) throw new Error('The export produced no file.');
	return { blob: new Blob([bytes], { type: 'video/mp4' }), video: conversion.isValid };
}

function toAudioBuffer(pcm: Pcm): AudioBuffer {
	const ctx = new OfflineAudioContext(pcm.channels.length, pcm.channels[0].length, pcm.rate);
	const buffer = ctx.createBuffer(pcm.channels.length, pcm.channels[0].length, pcm.rate);
	pcm.channels.forEach((ch, i) => buffer.copyToChannel(new Float32Array(ch), i));
	return buffer;
}

export function outputName(original: string): string {
	const dot = original.lastIndexOf('.');
	const stem = dot > 0 ? original.slice(0, dot) : original;
	return `${stem}.blr.mp4`;
}
