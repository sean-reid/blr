<script lang="ts">
	import { encodeWav } from '$lib/audio/wav';
	import { SAMPLE_RATE } from '$lib/audio/separate/mdx';
	import { VocalSeparator, type Provider, type Stems } from '$lib/audio/separate/separate';

	import { MODEL_URL, runtimeUrl as defaultRuntimeUrl } from '$lib/audio/separate/config';
	const providerChoices: { label: string; value: Provider[] }[] = [
		{ label: 'WebGPU, then WASM', value: ['webgpu', 'wasm'] },
		{ label: 'WebGPU only', value: ['webgpu'] },
		{ label: 'WASM only', value: ['wasm'] }
	];

	let modelUrl = $state(MODEL_URL);
	let runtimeUrl = $state('');
	let providerIndex = $state(0);
	let file = $state<File | null>(null);
	let status = $state<'idle' | 'loading' | 'running' | 'done' | 'error'>('idle');
	let message = $state('');
	let download = $state<{ loaded: number; total: number | null } | null>(null);
	let progress = $state<{ done: number; total: number } | null>(null);
	let result = $state<{
		provider: Provider;
		loadMs: number;
		separateMs: number;
		seconds: number;
		instrumental: string;
		vocals: string;
	} | null>(null);

	function urlFor(stems: Stems, stem: keyof Stems) {
		return URL.createObjectURL(
			new Blob([encodeWav(stems[stem], SAMPLE_RATE)], { type: 'audio/wav' })
		);
	}

	async function decode(blob: Blob): Promise<[Float32Array, Float32Array]> {
		const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
		try {
			const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
			const left = buffer.getChannelData(0);
			const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left.slice();
			return [left, right];
		} finally {
			await ctx.close();
		}
	}

	async function run() {
		if (!file) return;
		status = 'loading';
		message = '';
		result = null;
		progress = null;
		download = null;
		let separator: VocalSeparator | null = null;
		try {
			const mix = await decode(file);
			const seconds = mix[0].length / SAMPLE_RATE;
			const t0 = performance.now();
			separator = await VocalSeparator.load(modelUrl, {
				providers: providerChoices[providerIndex].value,
				runtimeUrl: runtimeUrl || defaultRuntimeUrl(),
				onDownload: (loaded, total) => (download = { loaded, total })
			});
			const t1 = performance.now();
			status = 'running';
			const stems = await separator.separate(mix, {
				onProgress: (done, total) => (progress = { done, total })
			});
			const t2 = performance.now();
			result = {
				provider: separator.provider,
				loadMs: t1 - t0,
				separateMs: t2 - t1,
				seconds,
				instrumental: urlFor(stems, 'instrumental'),
				vocals: urlFor(stems, 'vocals')
			};
			status = 'done';
		} catch (err) {
			status = 'error';
			message = err instanceof Error ? err.message : String(err);
		} finally {
			separator?.dispose();
		}
	}
</script>

<svelte:head>
	<title>BLR separation test bench</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="bench">
	<h1>Separation test bench</h1>
	<p class="muted">
		Runs MDX-Net vocal separation on a local audio or video file, entirely in this tab.
	</p>

	<label>
		<span>Model URL</span>
		<input type="text" bind:value={modelUrl} class="mono" />
	</label>

	<label>
		<span>Runtime URL (blank for the CDN copy)</span>
		<input type="text" bind:value={runtimeUrl} class="mono" />
	</label>

	<label>
		<span>Execution provider</span>
		<select bind:value={providerIndex}>
			{#each providerChoices as choice, i (choice.label)}
				<option value={i}>{choice.label}</option>
			{/each}
		</select>
	</label>

	<label>
		<span>Audio or video file</span>
		<input
			type="file"
			accept="audio/*,video/*"
			onchange={(e) => (file = e.currentTarget.files?.[0] ?? null)}
		/>
	</label>

	<button
		type="button"
		class="go"
		onclick={run}
		disabled={!file || status === 'loading' || status === 'running'}
	>
		Separate
	</button>

	<p class="mono status" data-status={status}>
		{#if status === 'loading'}
			{#if download}
				Downloading model {(download.loaded / 1e6).toFixed(1)} MB{download.total
					? ` of ${(download.total / 1e6).toFixed(1)} MB`
					: ''}
			{:else}
				Loading
			{/if}
		{:else if status === 'running'}
			Chunk {progress?.done ?? 0} of {progress?.total ?? '?'}
		{:else if status === 'error'}
			<span role="alert">{message}</span>
		{:else if status === 'done'}
			Done
		{/if}
	</p>

	{#if result}
		<dl class="mono">
			<dt>Provider</dt>
			<dd data-field="provider">{result.provider}</dd>
			<dt>Model load</dt>
			<dd data-field="loadMs">{result.loadMs.toFixed(0)} ms</dd>
			<dt>Separation</dt>
			<dd data-field="separateMs">{result.separateMs.toFixed(0)} ms</dd>
			<dt>Audio length</dt>
			<dd data-field="seconds">{result.seconds.toFixed(2)} s</dd>
			<dt>Realtime factor</dt>
			<dd data-field="realtime">{(result.seconds / (result.separateMs / 1000)).toFixed(2)}x</dd>
		</dl>
		<nav class="stems">
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a href={result.instrumental} download="instrumental.wav">Download instrumental</a>
			<a href={result.vocals} download="vocals.wav">Download vocals</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</nav>
	{/if}
</section>

<style>
	.bench {
		display: grid;
		gap: 16px;
	}

	h1 {
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}

	label {
		display: grid;
		gap: 6px;
		font-size: 0.875rem;
	}

	input[type='text'],
	select {
		min-height: var(--tap);
		padding: 8px 10px;
		border: 1px solid var(--ink-faint);
		border-radius: var(--radius);
		background: transparent;
		color: var(--ink);
		font: inherit;
	}

	input[type='file'] {
		min-height: var(--tap);
	}

	.go {
		justify-self: start;
		min-height: var(--tap);
		padding: 0 20px;
		border-radius: var(--radius);
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
	}

	.go:disabled {
		opacity: 0.4;
	}

	.status {
		min-height: 1.5em;
		font-size: 0.875rem;
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 4px 16px;
		font-size: 0.875rem;
	}

	dt {
		color: var(--ink-muted);
	}

	.stems {
		display: flex;
		gap: 20px;
	}

	.stems a {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
	}
</style>
