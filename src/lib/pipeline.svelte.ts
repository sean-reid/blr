import { decodeAudio, encodeWav16, toMono, TRANSCRIBE_RATE } from '$lib/media/audio';
import { groupLines } from '$lib/transcript/lines';
import type { Line, Transcript } from '$lib/transcript/types';
import { loadIndex } from '$lib/viseme/load';
import type { VisemeIndex } from '$lib/viseme/index';
import { rewriteAll, rewriteOne, scoreText, type Ranked } from '$lib/rewrite/client';
import type { Tone } from '$lib/rewrite/types';
import { decodeSpeech, speak } from '$lib/voice/client';
import { pcmFromBuffer, renderMix, type Spoken } from '$lib/voice/render';
import { defaultVoice } from '$lib/voice/voices';
import type { Pcm } from '$lib/audio/mix';
import { outputName, remux } from '$lib/media/remux';

export type Stage =
	| 'idle'
	| 'reading'
	| 'listening'
	| 'rewriting'
	| 'ready'
	| 'voicing'
	| 'mixing'
	| 'exporting'
	| 'failed';

export const STAGE_LABEL: Record<Stage, string> = {
	idle: '',
	reading: 'Reading.',
	listening: 'Listening.',
	rewriting: 'Rewriting.',
	ready: '',
	voicing: 'Voicing.',
	mixing: 'Mixing.',
	exporting: 'Exporting.',
	failed: ''
};

export interface Rewrite {
	options: Ranked[];
	pick: number;
	custom: Ranked | null;
	busy: boolean;
}

export class Pipeline {
	stage = $state<Stage>('idle');
	error = $state<string | null>(null);
	transcript = $state<Transcript | null>(null);
	lines = $state<Line[]>([]);
	rewrites = $state<Record<string, Rewrite>>({});
	tone = $state<Tone>('pg13');
	voices = $state<Record<number, string>>({});
	mixed = $state<Pcm | null>(null);
	stale = $state(false);
	output = $state<{ url: string; name: string } | null>(null);
	progress = $state(0);
	private file: File | null = null;
	private index: VisemeIndex | null = null;
	private bed: Pcm | null = null;

	async run(file: File) {
		this.file = file;
		this.stage = 'reading';
		this.error = null;
		try {
			const indexReady = loadIndex();
			const buffer = await decodeAudio(file);
			this.bed = pcmFromBuffer(buffer);
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
			for (const l of this.lines) this.voices[l.speaker] ??= defaultVoice(l.speaker);
			this.stage = 'rewriting';
			this.index = await indexReady;
			const ranked = await rewriteAll(this.index, this.lines, this.tone);
			for (const l of this.lines) {
				this.rewrites[l.id] = {
					options: ranked.get(l.id) ?? [],
					pick: 0,
					custom: null,
					busy: false
				};
			}
			this.stage = 'ready';
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			this.stage = 'failed';
		}
	}

	current(id: string): Ranked | null {
		const rw = this.rewrites[id];
		if (!rw) return null;
		return rw.custom ?? rw.options[rw.pick] ?? null;
	}

	text(id: string): string {
		return this.current(id)?.text ?? '';
	}

	async reroll(id: string) {
		const i = this.lines.findIndex((l) => l.id === id);
		const rw = this.rewrites[id];
		if (i < 0 || !rw || !this.index) return;
		this.stale = !!this.mixed;
		if (rw.custom) {
			this.rewrites[id] = { ...rw, custom: null };
			return;
		}
		if (rw.pick + 1 < rw.options.length) {
			this.rewrites[id] = { ...rw, pick: rw.pick + 1 };
			return;
		}
		this.rewrites[id] = { ...rw, busy: true };
		try {
			const neighbours = [this.lines[i - 1], this.lines[i + 1]]
				.filter(Boolean)
				.map((l) => ({ speaker: l.speaker, text: this.text(l.id) }));
			const fresh = await rewriteOne(this.index, this.lines[i], neighbours, this.tone);
			const known = rw.options.map((o) => o.text);
			const options = [...rw.options, ...fresh.filter((o) => !known.includes(o.text))];
			this.rewrites[id] = {
				options,
				pick: Math.min(rw.pick + 1, options.length - 1),
				custom: null,
				busy: false
			};
		} catch (e) {
			this.rewrites[id] = { ...rw, busy: false };
			this.error = e instanceof Error ? e.message : String(e);
		}
	}

	edit(id: string, text: string) {
		const line = this.lines.find((l) => l.id === id);
		const rw = this.rewrites[id];
		if (!line || !rw || !this.index) return;
		const trimmed = text.replace(/\s+/g, ' ').trim();
		if (!trimmed || trimmed === this.text(id)) return;
		this.rewrites[id] = { ...rw, custom: scoreText(this.index, line, trimmed) };
		this.stale = !!this.mixed;
	}

	setVoice(speaker: number, voice: string) {
		if (this.voices[speaker] === voice) return;
		this.voices[speaker] = voice;
		this.stale = !!this.mixed;
	}

	async voice() {
		if (!this.bed || this.stage !== 'ready') return;
		this.stage = 'voicing';
		this.error = null;
		try {
			const spoken: Spoken[] = [];
			for (const line of this.lines) {
				const text = this.text(line.id);
				if (!text) continue;
				const bytes = await speak(text, this.voices[line.speaker] ?? defaultVoice(line.speaker));
				const samples = await decodeSpeech(bytes);
				spoken.push({ line, samples, rate: samples.rate });
			}
			this.stage = 'mixing';
			await new Promise((r) => setTimeout(r));
			this.mixed = renderMix(this.bed, spoken);
			this.stale = false;
			this.dropOutput();
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		} finally {
			this.stage = 'ready';
		}
	}

	async export() {
		if (!this.file || !this.mixed || this.stage !== 'ready') return null;
		if (this.output) return this.output;
		this.stage = 'exporting';
		this.progress = 0;
		try {
			const { blob } = await remux(this.file, this.mixed, (p) => (this.progress = p));
			this.output = { url: URL.createObjectURL(blob), name: outputName(this.file.name) };
			return this.output;
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			return null;
		} finally {
			this.stage = 'ready';
		}
	}

	private dropOutput() {
		if (this.output) URL.revokeObjectURL(this.output.url);
		this.output = null;
	}

	reset() {
		this.dropOutput();
		this.file = null;
		this.stage = 'idle';
		this.error = null;
		this.transcript = null;
		this.lines = [];
		this.rewrites = {};
		this.voices = {};
		this.mixed = null;
		this.stale = false;
		this.bed = null;
	}
}
