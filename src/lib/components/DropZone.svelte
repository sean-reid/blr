<script lang="ts">
	import { onMount } from 'svelte';

	let { onfile }: { onfile: (file: File) => void } = $props();

	const accept = 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm';
	let input: HTMLInputElement;
	let over = $state(false);
	let error = $state<string | null>(null);
	let fetching = $state(false);

	async function sample() {
		fetching = true;
		try {
			const res = await fetch('/sample.mp4');
			if (!res.ok) throw new Error();
			take(new File([await res.blob()], 'sample.mp4', { type: 'video/mp4' }));
		} catch {
			error = 'The sample could not be loaded.';
		} finally {
			fetching = false;
		}
	}

	function isVideo(file: File) {
		return /^video\//.test(file.type) || /\.(mp4|mov|webm)$/i.test(file.name);
	}

	function take(file: File | undefined | null) {
		if (!file) return;
		if (!isVideo(file)) {
			error = 'That is not a video file.';
			return;
		}
		error = null;
		onfile(file);
	}

	function ondrop(e: DragEvent) {
		e.preventDefault();
		over = false;
		take(e.dataTransfer?.files[0]);
	}

	function onpaste(e: ClipboardEvent) {
		const file = Array.from(e.clipboardData?.files ?? []).find(isVideo);
		if (file) take(file);
	}

	onMount(() => {
		window.addEventListener('paste', onpaste);
		return () => window.removeEventListener('paste', onpaste);
	});
</script>

<div
	class="zone"
	class:over
	role="button"
	tabindex="0"
	aria-label="Choose a video"
	onclick={() => input.click()}
	onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.click())}
	ondragenter={(e) => (e.preventDefault(), (over = true))}
	ondragover={(e) => (e.preventDefault(), (over = true))}
	ondragleave={() => (over = false)}
	{ondrop}
>
	<p class="lead">Drop a video.</p>
	<p class="hint muted">MP4, MOV, WebM. Up to 3 minutes.</p>
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
</div>

<p class="sample">
	<button type="button" onclick={sample} disabled={fetching}>or try a sample</button>
</p>

<input
	bind:this={input}
	type="file"
	{accept}
	class="visually-hidden"
	tabindex="-1"
	onchange={(e) => {
		take(e.currentTarget.files?.[0]);
		e.currentTarget.value = '';
	}}
/>

<style>
	.zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		aspect-ratio: 4 / 3;
		border: 1px dashed var(--ink-faint);
		border-radius: var(--radius);
		cursor: pointer;
		user-select: none;
		transition:
			border-color var(--t-fast) var(--ease),
			background-color var(--t-fast) var(--ease);
	}

	.zone:hover,
	.zone.over {
		border-color: var(--ink);
	}

	.zone.over {
		background: rgb(211 64 31 / 5%);
	}

	.lead {
		font-size: 1.375rem;
		letter-spacing: -0.01em;
	}

	.hint {
		font-size: 0.875rem;
	}

	.error {
		margin-top: 8px;
		color: var(--accent);
		font-size: 0.875rem;
	}

	.sample {
		margin-top: 4px;
		font-size: 0.875rem;
		text-align: center;
	}

	.sample button {
		min-height: var(--tap);
		color: var(--ink-muted);
		text-decoration: underline;
		text-underline-offset: 0.16em;
	}

	.sample button:hover {
		color: var(--ink);
	}

	@media (min-width: 768px) {
		.zone {
			aspect-ratio: 16 / 9;
		}
	}
</style>
