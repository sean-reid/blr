<script lang="ts">
	import { VOICES } from '$lib/voice/voices';
	import { decodeSpeech, speak } from '$lib/voice/client';

	let {
		speaker,
		value,
		onchange
	}: { speaker: number; value: string; onchange: (voice: string) => void } = $props();

	let letter = $derived('ABCDEFGH'[speaker] ?? '?');
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

<label class="picker" style:--swatch="var(--speaker-{'abcdefgh'[speaker] ?? 'a'})">
	<span class="letter">{letter}</span>
	<select
		{value}
		aria-label="Voice for speaker {letter}"
		onchange={(e) => onchange(e.currentTarget.value)}
	>
		{#each VOICES as v (v.id)}
			<option value={v.id}>{v.label}</option>
		{/each}
	</select>
	<button
		type="button"
		class="hear mono"
		onclick={hear}
		disabled={playing}
		aria-label="Hear speaker {letter}"
	>
		{playing ? '…' : 'Hear'}
	</button>
</label>

<style>
	.picker {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: var(--tap);
	}

	.letter {
		width: 24px;
		height: 24px;
		display: grid;
		place-items: center;
		border: 1px solid var(--swatch);
		border-radius: var(--radius);
		color: var(--swatch);
		font-size: 0.75rem;
		font-weight: 600;
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
