<script lang="ts">
	import DropZone from '$lib/components/DropZone.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import Transcript from '$lib/components/Transcript.svelte';
	import { Pipeline, STAGE_LABEL } from '$lib/pipeline.svelte';

	const pipeline = new Pipeline();
	let file = $state<File | null>(null);
	let url = $state<string | null>(null);
	let video = $state<HTMLVideoElement | null>(null);
	let time = $state(0);

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
	let busy = $derived(
		pipeline.stage === 'reading' || pipeline.stage === 'listening' || pipeline.stage === 'rewriting'
	);

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

	function seek(t: number) {
		if (!video) return;
		video.currentTime = t;
		video.play().catch(() => {});
	}
</script>

<section class="stage">
	{#if file && url}
		<div class="frame">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={video}
				src={url}
				controls
				playsinline
				preload="metadata"
				ontimeupdate={(e) => (time = e.currentTarget.currentTime)}
			></video>
			{#if busy}
				<Progress label={STAGE_LABEL[pipeline.stage]} />
			{/if}
		</div>

		{#if pipeline.stage === 'failed'}
			<p class="error" role="alert">{pipeline.error}</p>
		{/if}

		{#if pipeline.stage === 'ready'}
			<Transcript
				lines={pipeline.lines}
				rewrites={views}
				{current}
				onseek={seek}
				onreroll={(id) => pipeline.reroll(id)}
				onedit={(id, text) => pipeline.edit(id, text)}
			/>
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

	video {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		border-radius: var(--radius);
	}

	.error {
		color: var(--accent);
		font-size: 0.9375rem;
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
