<script lang="ts">
	import DropZone from '$lib/components/DropZone.svelte';
	import Player from '$lib/components/Player.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import Transcript from '$lib/components/Transcript.svelte';
	import VoicePicker from '$lib/components/VoicePicker.svelte';
	import { Pipeline, STAGE_LABEL } from '$lib/pipeline.svelte';
	import { speakersOf } from '$lib/transcript/lines';

	const pipeline = new Pipeline();
	let file = $state<File | null>(null);
	let url = $state<string | null>(null);
	let video = $state<HTMLVideoElement | null>(null);
	let time = $state(0);
	let useMixed = $state(true);

	let current = $derived(
		pipeline.lines.find((l) => time >= l.start && time < l.end + 0.15)?.id ?? null
	);
	let views = $derived(
		Object.fromEntries(
			pipeline.lines.map((l) => [
				l.id,
				{ current: pipeline.current(l.id), busy: pipeline.rewrites[l.id]?.busy ?? false }
			])
		)
	);
	let busy = $derived(!['idle', 'ready', 'failed'].includes(pipeline.stage));
	let speakers = $derived(speakersOf(pipeline.lines));

	function take(f: File) {
		file = f;
		url = URL.createObjectURL(f);
		pipeline.run(f);
	}

	function reset() {
		if (url) URL.revokeObjectURL(url);
		file = null;
		url = null;
		time = 0;
		pipeline.reset();
	}

	async function download() {
		const out = await pipeline.export();
		if (!out) return;
		const a = document.createElement('a');
		a.href = out.url;
		a.download = out.name;
		a.click();
	}

	function seek(t: number) {
		if (!video) return;
		video.currentTime = t;
		video.play().catch(() => {});
	}
</script>

<section class="stage">
	{#if file && url}
		<div class="frame">
			<Player src={url} mixed={pipeline.mixed} {useMixed} bind:video ontime={(t) => (time = t)} />
			{#if busy}
				<Progress
					label={STAGE_LABEL[pipeline.stage]}
					fraction={pipeline.stage === 'exporting' ? pipeline.progress : null}
				/>
			{/if}
		</div>

		{#if pipeline.error}
			<p class="error" role="alert">{pipeline.error}</p>
		{/if}

		{#if pipeline.lines.length}
			<Transcript
				lines={pipeline.lines}
				rewrites={views}
				{current}
				onseek={seek}
				onreroll={(id) => pipeline.reroll(id)}
				onedit={(id, text) => pipeline.edit(id, text)}
			/>

			<div class="actions">
				<div class="voices">
					{#each speakers as sp (sp)}
						<VoicePicker
							speaker={sp}
							value={pipeline.voices[sp]}
							onchange={(v) => pipeline.setVoice(sp, v)}
						/>
					{/each}
				</div>
				<div class="run">
					{#if pipeline.mixed}
						<label class="toggle mono">
							<input type="checkbox" bind:checked={useMixed} />
							New audio
						</label>
					{/if}
					{#if pipeline.mixed && !pipeline.stale}
						<button type="button" class="plain" disabled={busy} onclick={() => pipeline.voice()}>
							Voice it again
						</button>
						<button type="button" class="primary" disabled={busy} onclick={download}>
							Download
						</button>
					{:else}
						<button
							type="button"
							class="primary"
							disabled={busy || pipeline.stage !== 'ready'}
							onclick={() => pipeline.voice()}
						>
							{pipeline.mixed ? 'Voice it again' : 'Voice it'}
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<div class="meta mono muted">
			<span>{file.name}</span>
			<button type="button" onclick={reset}>Remove</button>
		</div>
	{:else}
		<DropZone onfile={take} />
	{/if}
</section>

<style>
	.stage {
		display: grid;
		gap: 16px;
	}

	.frame {
		position: relative;
	}

	.error {
		color: var(--accent);
		font-size: 0.9375rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 24px;
	}

	.voices {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 24px;
	}

	.run {
		display: flex;
		align-items: center;
		gap: 20px;
		margin-left: auto;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: var(--tap);
		cursor: pointer;
	}

	.toggle input {
		accent-color: var(--accent);
		width: 16px;
		height: 16px;
		margin: 0;
	}

	.plain {
		min-height: var(--tap);
		padding-inline: 4px;
		color: var(--ink-muted);
	}

	.plain:hover:not(:disabled) {
		color: var(--ink);
	}

	.primary {
		min-height: var(--tap);
		padding: 0 20px;
		background: var(--accent);
		color: var(--accent-ink);
		border-radius: var(--radius);
		font-weight: 600;
		transition: opacity var(--t-fast) var(--ease);
	}

	.primary:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.meta {
		display: flex;
		gap: 16px;
		align-items: center;
	}

	.meta span {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta button {
		min-height: var(--tap);
		color: var(--ink-muted);
	}

	.meta button:hover {
		color: var(--ink);
	}
</style>
