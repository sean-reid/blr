<script lang="ts">
	import DropZone from '$lib/components/DropZone.svelte';

	let file = $state<File | null>(null);
	let url = $derived(file ? URL.createObjectURL(file) : null);
	let duration = $state<number | null>(null);

	function fmt(s: number) {
		const m = Math.floor(s / 60);
		const r = Math.floor(s % 60);
		return `${m}:${String(r).padStart(2, '0')}`;
	}

	function reset() {
		if (url) URL.revokeObjectURL(url);
		file = null;
		duration = null;
	}
</script>

<section class="stage">
	{#if file && url}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			src={url}
			controls
			playsinline
			onloadedmetadata={(e) => (duration = e.currentTarget.duration)}
		></video>
		<div class="meta mono muted">
			<span>{file.name}</span>
			<span>{duration === null ? '' : fmt(duration)}</span>
			<button type="button" onclick={reset}>Remove</button>
		</div>
	{:else}
		<DropZone onfile={(f) => (file = f)} />
	{/if}
</section>

<style>
	.stage {
		display: grid;
		gap: 12px;
	}

	video {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		border-radius: var(--radius);
	}

	.meta {
		display: flex;
		gap: 16px;
		align-items: center;
	}

	.meta span:first-child {
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
