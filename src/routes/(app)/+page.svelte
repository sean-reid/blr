<script lang="ts">
	import DropZone from '$lib/components/DropZone.svelte';
	import TrimBar from '$lib/components/TrimBar.svelte';
	import { initialRange, type Range } from '$lib/media/range';
	import Player, { type Caption } from '$lib/components/Player.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import Transcript from '$lib/components/Transcript.svelte';
	import VoicePicker from '$lib/components/VoicePicker.svelte';
	import { Pipeline, STAGE_LABEL } from '$lib/pipeline.svelte';
	import { Session } from '$lib/session';
	import { audible, speakersOf } from '$lib/transcript/lines';
	import { speakerName } from '$lib/transcript/names';
	import { outputName } from '$lib/media/names';
	import { posterFrame, uploadShare } from '$lib/share/client';
	import { toShareLines } from '$lib/share/lines';
	import { vttToSrt } from '$lib/share/srt';
	import { toVtt } from '$lib/share/vtt';
	import type { ShareResult } from '$lib/share/types';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let challenge = $state<HTMLDivElement | null>(null);
	const session = new Session(
		() => data.siteKey,
		() => challenge
	);
	const pipeline = new Pipeline(session.fetch);
	let file = $state<File | null>(null);
	let url = $state<string | null>(null);
	let video = $state<HTMLVideoElement | null>(null);
	let time = $state(0);
	let useMixed = $state(true);
	let captions = $state(false);
	let sharing = $state<number | null>(null);
	let shared = $state<(ShareResult & { output: string }) | null>(null);
	let copied = $state(false);

	let current = $derived(
		(
			pipeline.lines.find((l) => time >= l.start && time < l.end) ??
			pipeline.lines.find((l) => time >= l.start && time < l.end + 0.15)
		)?.id ?? null
	);
	let views = $derived(
		Object.fromEntries(
			pipeline.lines.map((l) => [
				l.id,
				{ current: pipeline.current(l.id), busy: pipeline.rewrites[l.id]?.busy ?? false }
			])
		)
	);
	let busy = $derived(!['idle', 'ready', 'failed'].includes(pipeline.stage) || sharing !== null);
	let label = $derived.by(() => {
		if (sharing !== null) return 'Sharing.';
		if (pipeline.stage === 'separating' && pipeline.download) {
			const mb = (pipeline.download.total / 1e6).toFixed(0);
			const pct = Math.round((100 * pipeline.download.loaded) / pipeline.download.total);
			return `Fetching the separation model, ${mb} MB. ${pct}%`;
		}
		return STAGE_LABEL[pipeline.stage];
	});
	let fraction = $derived.by(() => {
		if (sharing !== null) return sharing;
		if (pipeline.stage === 'exporting') return pipeline.progress;
		if (pipeline.stage === 'separating' && !pipeline.download) return pipeline.progress;
		return null;
	});
	let speakers = $derived(speakersOf(pipeline.lines));
	let link = $derived(
		shared && !pipeline.stale && pipeline.output?.url === shared.output ? shared : null
	);
	let caption = $derived.by((): Caption | null => {
		if (!captions || !useMixed || !pipeline.mixed || !current || pipeline.muted[current])
			return null;
		const line = pipeline.lines.find((l) => l.id === current);
		const text = pipeline.text(current);
		if (!line || !text) return null;
		return { text, label: speakerName(line.speaker, pipeline.names), speaker: line.speaker };
	});

	let trimming = $state<{ file: File; url: string; duration: number; range: Range } | null>(null);
	let trimVideo = $state<HTMLVideoElement | null>(null);

	function take(f: File, range: Range | null = null) {
		file = f;
		url = URL.createObjectURL(f);
		pipeline.run(f, range);
	}

	function trim(f: File, duration: number) {
		const range = initialRange(duration);
		if (!range) return take(f);
		trimming = { file: f, url: URL.createObjectURL(f), duration, range };
	}

	function useTrimmed() {
		if (!trimming) return;
		const { file: f, url: u, range } = trimming;
		trimming = null;
		file = f;
		url = u;
		pipeline.run(f, range);
	}

	function reset() {
		if (url) URL.revokeObjectURL(url);
		if (trimming) URL.revokeObjectURL(trimming.url);
		trimming = null;
		file = null;
		url = null;
		time = 0;
		pipeline.reset();
	}

	function save(href: string, name: string) {
		const a = document.createElement('a');
		a.href = href;
		a.download = name;
		a.click();
	}

	async function download() {
		const out = await pipeline.export();
		if (out) save(out.url, out.name);
	}

	function shareLines() {
		return toShareLines(audible(pipeline.lines, pipeline.muted), (id) => pipeline.text(id));
	}

	function sidecar(kind: 'vtt' | 'srt') {
		if (!file) return;
		const vtt = toVtt(shareLines(), pipeline.names);
		const body = kind === 'srt' ? vttToSrt(vtt) : vtt;
		const type = kind === 'srt' ? 'application/x-subrip' : 'text/vtt';
		const href = URL.createObjectURL(new Blob([body], { type }));
		save(href, outputName(file.name, kind));
		setTimeout(() => URL.revokeObjectURL(href), 10_000);
	}

	async function share() {
		if (!url || sharing !== null) return;
		const out = await pipeline.export();
		if (!out) return;
		sharing = 0;
		pipeline.error = null;
		try {
			const [blob, poster] = await Promise.all([
				fetch(out.url).then((r) => r.blob()),
				posterFrame(url, pipeline.lines[0]?.start ?? 0)
			]);
			const result = await uploadShare(
				blob,
				poster,
				shareLines(),
				(f) => (sharing = f),
				(fresh) => session.bearer(fresh)
			);
			shared = { ...result, output: out.url };
		} catch (e) {
			pipeline.error = e instanceof Error ? e.message : String(e);
		} finally {
			sharing = null;
		}
	}

	async function copy() {
		if (!link) return;
		await navigator.clipboard.writeText(link.url);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function seek(t: number) {
		if (!video) return;
		video.currentTime = t;
		video.play().catch(() => {});
	}

	function keys(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
		const target = e.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable]')) return;
		if (e.key === ' ' && video) {
			if (target?.closest('button, a, video, summary')) return;
			e.preventDefault();
			if (video.paused) video.play().catch(() => {});
			else video.pause();
		} else if (e.key === 'r' && current) {
			pipeline.reroll(current);
		} else if (e.key === 'm' && current) {
			pipeline.toggleMute(current);
		}
	}
</script>

<svelte:window onkeydown={keys} />

<section class="stage">
	{#if file && url}
		<div class="frame" data-separation={pipeline.separation}>
			<Player
				src={url}
				mixed={pipeline.mixed}
				{useMixed}
				range={pipeline.range}
				{caption}
				bind:video
				ontime={(t) => (time = t)}
			/>
			{#if busy}
				<Progress {label} {fraction} />
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
				names={pipeline.names}
				muted={pipeline.muted}
				onseek={seek}
				onreroll={(id) => pipeline.reroll(id)}
				onedit={(id, text) => pipeline.edit(id, text)}
				onmute={(id) => pipeline.toggleMute(id)}
				onrename={(sp, name) => pipeline.setName(sp, name)}
			/>

			<div class="actions">
				<div class="settings">
					<div class="voices">
						{#each speakers as sp (sp)}
							<VoicePicker
								speaker={sp}
								value={pipeline.voices[sp]}
								names={pipeline.names}
								onchange={(v) => pipeline.setVoice(sp, v)}
								onrename={(s, name) => pipeline.setName(s, name)}
							/>
						{/each}
					</div>
					<div class="toggles">
						<label class="toggle mono">
							<input
								type="checkbox"
								checked={pipeline.tone === 'clean'}
								disabled={busy}
								onchange={(e) => pipeline.setTone(e.currentTarget.checked ? 'clean' : 'pg13')}
							/>
							Clean
						</label>
						{#if pipeline.mixed}
							<label class="toggle mono">
								<input type="checkbox" bind:checked={useMixed} />
								New audio
							</label>
							<label class="toggle mono">
								<input type="checkbox" bind:checked={captions} />
								Captions
							</label>
						{/if}
					</div>
				</div>
				<div class="run">
					{#if pipeline.mixed && !pipeline.stale}
						<button type="button" class="plain" disabled={busy} onclick={() => pipeline.voice()}>
							Voice it again
						</button>
						<button type="button" class="primary" disabled={busy} onclick={download}>
							Download
						</button>
						<span class="sidecars mono">
							<button type="button" class="plain" onclick={() => sidecar('vtt')}>VTT</button>
							<button type="button" class="plain" onclick={() => sidecar('srt')}>SRT</button>
						</span>
						{#if link}
							<div class="link">
								<a
									href={resolve('/s/[id]', { id: link.id })}
									class="mono"
									target="_blank"
									rel="noopener"
								>
									{link.url.replace(/^https?:\/\//, '')}
								</a>
								<button type="button" class="plain" onclick={copy}>
									{copied ? 'Copied' : 'Copy'}
								</button>
								<span class="mono muted">Expires in 7 days</span>
							</div>
						{:else}
							<button type="button" class="primary" disabled={busy} onclick={share}> Share </button>
						{/if}
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
			{#if pipeline.separation === 'unavailable'}
				<span class="note">Vocals kept under the new lines. Separation is unavailable here.</span>
			{/if}
			<button type="button" onclick={reset}>Remove</button>
		</div>
	{:else if trimming}
		<div class="frame">
			<Player src={trimming.url} bind:video={trimVideo} />
		</div>
		<TrimBar
			duration={trimming.duration}
			bind:range={trimming.range}
			onscrub={(t) => {
				if (trimVideo) trimVideo.currentTime = t;
			}}
			onuse={useTrimmed}
		/>
		<div class="meta mono muted">
			<span>{trimming.file.name}</span>
			<button type="button" onclick={reset}>Remove</button>
		</div>
	{:else}
		<DropZone onfile={take} ontrim={trim} />
	{/if}
	<div class="challenge" bind:this={challenge}></div>
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

	.challenge:empty {
		display: none;
	}

	.actions {
		display: grid;
		gap: 12px;
	}

	.settings {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px 24px;
	}

	.voices {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 24px;
	}

	.toggles {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 20px;
		margin-left: auto;
	}

	.run {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 12px 20px;
	}

	.link {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
	}

	.link a {
		color: var(--accent);
		word-break: break-all;
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

	.toggle input:disabled {
		cursor: default;
	}

	.plain {
		min-height: var(--tap);
		padding-inline: 4px;
		color: var(--ink-muted);
	}

	.plain:hover:not(:disabled) {
		color: var(--ink);
	}

	.sidecars {
		display: inline-flex;
		gap: 4px;
	}

	.sidecars .plain {
		font: inherit;
		letter-spacing: inherit;
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

	.meta .note {
		flex: 2;
		white-space: normal;
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
