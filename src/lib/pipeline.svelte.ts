import { decodeAudio, encodeWav16, toMono, TRANSCRIBE_RATE } from '$lib/media/audio';
import { audible, groupLines } from '$lib/transcript/lines';
import type { Names } from '$lib/transcript/names';
import type { Line, Transcript } from '$lib/transcript/types';
import { loadIndex } from '$lib/viseme/load';
import type { VisemeIndex } from '$lib/viseme/index';
import { rewriteAll, rewriteOne, scoreText, type Ranked } from '$lib/rewrite/client';
import type { Tone } from '$lib/rewrite/types';
import { decodeSpeech, speak } from '$lib/voice/client';
import { pcmFromBuffer, renderMix, type Spoken } from '$lib/voice/render';
import { defaultVoice } from '$lib/voice/voices';
import { resample, restore, type Pcm } from '$lib/audio/mix';
import { outputName } from '$lib/media/names';
import type { Range } from '$lib/media/range';
import {
	MODEL_BYTES,
	MODEL_SHA256,
	MODEL_URL,
	runtimeUrl,
	sha256Hex
} from '$lib/audio/separate/config';
import { SAMPLE_RATE, type Stereo } from '$lib/audio/separate/mdx';
import { pickVoices, speakerPitches } from '$lib/voice/pitch';

export type Stage =
	| 'idle'
	| 'reading'
	| 'listening'
	| 'rewriting'
	| 'ready'
	| 'separating'
	| 'voicing'
	| 'mixing'
	| 'exporting'
	| 'failed';

export type Separation = 'pending' | 'ready' | 'unavailable';

export const STAGE_LABEL: Record<Stage, string> = {
	idle: '',
	reading: 'Reading.',
	listening: 'Listening.',
	rewriting: 'Rewriting.',
	ready: '',
	separating: 'Separating.',
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
	names = $state<Names>({});
	muted = $state<Record<string, boolean>>({});
	mixed = $state<Pcm | null>(null);
	stale = $state(false);
	output = $state<{ url: string; name: string } | null>(null);
	progress = $state(0);
	separation = $state<Separation>('pending');
	download = $state<{ loaded: number; total: number } | null>(null);
	private file: File | null = null;
	range: Range | null = null;
	private stems: Promise<Pcm | null> | null = null;
	private index: VisemeIndex | null = null;
	private bed: Pcm | null = null;

	constructor(private fetcher: typeof fetch = fetch) {}

	async run(file: File, range: Range | null = null) {
		this.file = file;
		this.range = range;
		this.stage = 'reading';
		this.error = null;
		try {
			const indexReady = loadIndex();
			const buffer = await decodeAudio(file);
			this.bed = slicePcm(pcmFromBuffer(buffer), range);
			this.stems = this.separate(this.bed);
			const mono = sliceMono(await toMono(buffer, TRANSCRIBE_RATE), TRANSCRIBE_RATE, range);
			const wav = encodeWav16(mono, TRANSCRIBE_RATE);
			this.stage = 'listening';
			const res = await this.fetcher(`/api/transcribe?duration=${buffer.duration.toFixed(3)}`, {
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
			const picked = pickVoices(speakerPitches(mono, TRANSCRIBE_RATE, this.lines));
			this.lines = shiftLines(this.lines, range?.start ?? 0);
			for (const l of this.lines)
				this.voices[l.speaker] ??= picked[l.speaker] ?? defaultVoice(l.speaker);
			this.stage = 'rewriting';
			this.index = await indexReady;
			this.fill(await rewriteAll(this.index, this.lines, this.tone, this.fetcher));
			this.stage = 'ready';
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			this.stage = 'failed';
		}
	}

	private fill(ranked: Map<string, Ranked[]>) {
		for (const l of this.lines) {
			this.rewrites[l.id] = {
				options: ranked.get(l.id) ?? [],
				pick: 0,
				custom: null,
				busy: false
			};
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
			const fresh = await rewriteOne(
				this.index,
				this.lines[i],
				neighbours,
				this.tone,
				this.fetcher
			);
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

	setName(speaker: number, name: string) {
		const trimmed = name.replace(/\s+/g, ' ').trim();
		if (trimmed) this.names[speaker] = trimmed;
		else delete this.names[speaker];
	}

	toggleMute(id: string) {
		if (!this.lines.some((l) => l.id === id)) return;
		this.muted[id] = !this.muted[id];
		this.stale = !!this.mixed;
	}

	async setTone(tone: Tone) {
		if (tone === this.tone) return;
		this.tone = tone;
		if (this.stage !== 'ready' || !this.index || !this.lines.length) return;
		this.stage = 'rewriting';
		this.error = null;
		try {
			this.fill(await rewriteAll(this.index, this.lines, tone, this.fetcher));
			this.stale = !!this.mixed;
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		} finally {
			this.stage = 'ready';
		}
	}

	async voice() {
		if (!this.bed || this.stage !== 'ready') return;
		this.stage = 'voicing';
		this.error = null;
		try {
			const spoken: Spoken[] = [];
			for (const line of audible(this.lines, this.muted)) {
				const text = this.text(line.id);
				if (!text) continue;
				const voice = this.voices[line.speaker] ?? defaultVoice(line.speaker);
				const bytes = await speak(text, voice, this.fetcher);
				const samples = await decodeSpeech(bytes);
				spoken.push({ line, samples, rate: samples.rate });
			}
			let bed = this.bed;
			let duckBed = true;
			if (this.separation === 'pending' && this.stems) {
				this.stage = 'separating';
				const stems = await this.stems;
				if (stems) {
					bed = stems;
					duckBed = false;
				}
			} else if (this.separation === 'ready' && this.stems) {
				bed = (await this.stems) ?? bed;
				duckBed = bed === this.bed;
			}
			if (bed !== this.bed) {
				const kept = this.lines.filter((l) => this.muted[l.id]);
				bed = restore(bed, this.bed, kept);
			}
			this.stage = 'mixing';
			await new Promise((r) => setTimeout(r));
			const offset = this.range?.start ?? 0;
			const local = spoken.map((s) => ({
				...s,
				line: { ...s.line, start: s.line.start - offset, end: s.line.end - offset }
			}));
			this.mixed = renderMix(bed, local, duckBed);
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
			const { remux } = await import('$lib/media/remux');
			const { blob } = await remux(this.file, this.mixed, (p) => (this.progress = p), this.range);
			this.output = { url: URL.createObjectURL(blob), name: outputName(this.file.name) };
			return this.output;
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			return null;
		} finally {
			this.stage = 'ready';
		}
	}

	// Runs in the background from the moment the audio is decoded; failure of
	// any kind falls back to ducking the original under the new lines.
	private async separate(bed: Pcm): Promise<Pcm | null> {
		this.separation = 'pending';
		this.progress = 0;
		try {
			const res = await fetch(MODEL_URL);
			if (!res.ok || !res.body) throw new Error(`model ${res.status}`);
			const total = Number(res.headers.get('content-length')) || MODEL_BYTES;
			const parts: Uint8Array[] = [];
			let loaded = 0;
			const reader = res.body.getReader();
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				parts.push(value);
				loaded += value.byteLength;
				this.download = { loaded, total };
			}
			const bytes = new Uint8Array(loaded);
			let offset = 0;
			for (const part of parts) {
				bytes.set(part, offset);
				offset += part.byteLength;
			}
			this.download = null;
			if ((await sha256Hex(bytes.buffer)) !== MODEL_SHA256) throw new Error('model hash mismatch');
			const { VocalSeparator } = await import('$lib/audio/separate/separate');
			const separator = await VocalSeparator.load(bytes.buffer, { runtimeUrl: runtimeUrl() });
			try {
				const left = resample(bed.channels[0], bed.rate, SAMPLE_RATE);
				const right = resample(bed.channels[1] ?? bed.channels[0], bed.rate, SAMPLE_RATE);
				const mix: Stereo = [left, right];
				const stems = await separator.separate(mix, {
					onProgress: (done, count) => (this.progress = done / count)
				});
				const channels = stems.instrumental.map((ch) => resample(ch, SAMPLE_RATE, bed.rate));
				this.separation = 'ready';
				return { rate: bed.rate, channels: channels.slice(0, bed.channels.length) };
			} finally {
				separator.dispose();
			}
		} catch (e) {
			console.info('separation unavailable:', e instanceof Error ? e.message : e);
			this.separation = 'unavailable';
			return null;
		}
	}

	private dropOutput() {
		if (this.output) URL.revokeObjectURL(this.output.url);
		this.output = null;
	}

	reset() {
		this.dropOutput();
		this.file = null;
		this.range = null;
		this.stage = 'idle';
		this.error = null;
		this.transcript = null;
		this.lines = [];
		this.rewrites = {};
		this.voices = {};
		this.names = {};
		this.muted = {};
		this.mixed = null;
		this.stale = false;
		this.bed = null;
		this.stems = null;
		this.separation = 'pending';
		this.download = null;
	}
}

function slicePcm(pcm: Pcm, range: Range | null): Pcm {
	if (!range) return pcm;
	const a = Math.round(range.start * pcm.rate);
	const b = Math.round(range.end * pcm.rate);
	return { rate: pcm.rate, channels: pcm.channels.map((ch) => ch.slice(a, b)) };
}

function sliceMono(mono: Float32Array, rate: number, range: Range | null): Float32Array {
	if (!range) return mono;
	return mono.slice(Math.round(range.start * rate), Math.round(range.end * rate));
}

function shiftLines(lines: Line[], offset: number): Line[] {
	if (!offset) return lines;
	return lines.map((l) => ({
		...l,
		start: l.start + offset,
		end: l.end + offset,
		words: l.words.map((w) => ({ ...w, start: w.start + offset, end: w.end + offset }))
	}));
}
