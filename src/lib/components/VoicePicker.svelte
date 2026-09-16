<script lang="ts">
	import { VOICES } from '$lib/voice/voices';
	import { decodeSpeech, speak } from '$lib/voice/client';
	import { speakerLetter, speakerTitle, type Names } from '$lib/transcript/names';
	import SpeakerName from './SpeakerName.svelte';

	let {
		speaker,
		value,
		names = {},
		onchange,
		onrename
	}: {
		speaker: number;
		value: string;
		names?: Names;
		onchange: (voice: string) => void;
		onrename?: (speaker: number, name: string) => void;
	} = $props();

	let letter = $derived(speakerLetter(speaker));
	let title = $derived(speakerTitle(speaker, names));
	let playing = $state(false);

	async function hear() {
		if (playing) return;
		playing = true;
		try {
			const samples = await decodeSpeech(await speak(`Hi, I'm speaker ${letter}.`, value));
			const ctx = new AudioContext();
			const buffer = ctx.createBuffer(1, samples.length, samples.rate);
			buffer.copyToChannel(new Float32Array(samples), 0);
			const src = ctx.createBufferSource();
			src.buffer = buffer;
			src.connect(ctx.destination);
			src.onended = () => {
				ctx.close();
				playing = false;
			};
			src.start();
		} catch {
			playing = false;
		}
	}
</script>

<div class="picker" style:--swatch="var(--speaker-{'abcdefgh'[speaker] ?? 'a'})">
	<SpeakerName {speaker} {names} size="picker" {onrename} />
	<select {value} aria-label="Voice for {title}" onchange={(e) => onchange(e.currentTarget.value)}>
		{#each VOICES as v (v.id)}
			<option value={v.id}>{v.label}</option>
		{/each}
	</select>
	<button
		type="button"
		class="hear mono"
		onclick={hear}
		disabled={playing}
		aria-label="Hear {title}"
	>
		{playing ? '…' : 'Hear'}
	</button>
</div>

<style>
	.picker {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: var(--tap);
	}

	select {
		appearance: none;
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--ink-faint);
		padding: 6px 0;
		min-height: var(--tap);
		cursor: pointer;
	}

	select:hover {
		border-color: var(--ink);
	}

	.hear {
		min-height: var(--tap);
		padding-inline: 4px;
		color: var(--ink-muted);
	}

	.hear:hover:not(:disabled) {
		color: var(--ink);
	}
</style>
