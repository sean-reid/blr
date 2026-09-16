import { decodeAudio, encodeWav16, toMono, TRANSCRIBE_RATE } from '$lib/media/audio';
import { groupLines } from '$lib/transcript/lines';
import type { Line, Transcript } from '$lib/transcript/types';

export type Stage = 'idle' | 'reading' | 'listening' | 'ready' | 'failed';

export const STAGE_LABEL: Record<Stage, string> = {
	idle: '',
	reading: 'Reading.',
	listening: 'Listening.',
	ready: '',
	failed: ''
};

export class Pipeline {
	stage = $state<Stage>('idle');
	error = $state<string | null>(null);
	transcript = $state<Transcript | null>(null);
	lines = $state<Line[]>([]);

	async run(file: File) {
		this.stage = 'reading';
		this.error = null;
		try {
			const buffer = await decodeAudio(file);
			const mono = await toMono(buffer, TRANSCRIBE_RATE);
			const wav = encodeWav16(mono, TRANSCRIBE_RATE);
			this.stage = 'listening';
			const res = await fetch(`/api/transcribe?duration=${buffer.duration.toFixed(3)}`, {
				method: 'POST',
				headers: { 'content-type': 'audio/wav' },
				body: wav
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { message?: string } | null;
				throw new Error(body?.message ?? res.statusText);
			}
			this.transcript = (await res.json()) as Transcript;
			this.lines = groupLines(this.transcript);
			if (!this.lines.length)
				throw new Error('No speech was heard. Try a clip with clearer voices.');
			this.stage = 'ready';
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			this.stage = 'failed';
		}
	}

	reset() {
		this.stage = 'idle';
		this.error = null;
		this.transcript = null;
		this.lines = [];
	}
}
