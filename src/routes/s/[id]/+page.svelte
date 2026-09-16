<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { speakerLetter } from '$lib/share/types';

	let { data } = $props();

	const base = $derived(`${page.url.origin}/s/${data.id}`);
	const video = $derived(`${base}/video.mp4`);
	const poster = $derived(`${base}/poster.jpg`);
	const captions = $derived(`${base}/captions.vtt`);
	const description = $derived(
		data.lines
			.map((l) => l.text.trim())
			.filter(Boolean)
			.slice(0, 2)
			.join(' ')
	);
	const expires = $derived(formatDate(data.expires));

	const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

	function formatDate(iso: string) {
		const d = new Date(iso);
		return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
	}

	function fmt(s: number) {
		const m = Math.floor(s / 60);
		const r = s - m * 60;
		return `${m}:${r.toFixed(1).padStart(4, '0')}`;
	}
</script>

<svelte:head>
	<title>Bad lip reading</title>
	<meta name="robots" content="noindex" />
	<meta name="description" content={description} />
	<meta property="og:type" content="video.other" />
	<meta property="og:title" content="Bad lip reading" />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={base} />
	<meta property="og:image" content={poster} />
	<meta property="og:image:type" content="image/jpeg" />
	<meta property="og:video" content={video} />
	<meta property="og:video:type" content="video/mp4" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Bad lip reading" />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={poster} />
</svelte:head>

<section class="share">
	<video controls playsinline preload="metadata" {poster} src={video}>
		<track kind="captions" src={captions} srclang="en" label="New lines" default />
	</video>

	<ol class="lines">
		{#each data.lines as line, i (i)}
			<li style:--swatch="var(--speaker-{'abcdefgh'[line.speaker] ?? 'a'})">
				<span class="speaker" aria-label="Speaker {speakerLetter(line.speaker)}">
					{speakerLetter(line.speaker)}
				</span>
				<div class="body">
					<p class="original">
						<span class="time mono muted">{fmt(line.start)}</span>
						<span class="muted">{line.original}</span>
					</p>
					<p class="new">{line.text}</p>
				</div>
			</li>
		{/each}
	</ol>

	<div class="meta">
		<p class="mono muted">Expires {expires}</p>
		<a href={resolve('/')} class="make">Make your own</a>
	</div>
</section>

<style>
	.share {
		display: grid;
		gap: 16px;
	}

	video {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		border-radius: var(--radius);
	}

	video::cue {
		background: rgb(20 18 15 / 85%);
		color: #f5f1ea;
		font-family: 'Instrument Sans', system-ui, sans-serif;
		font-size: 1.0625rem;
		line-height: 1.4;
	}

	.lines {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
	}

	li {
		display: grid;
		grid-template-columns: 32px 1fr;
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--ink-hairline);
	}

	li:last-child {
		border-bottom: 1px solid var(--ink-hairline);
	}

	.speaker {
		width: 32px;
		height: 32px;
		margin-top: 2px;
		display: grid;
		place-items: center;
		border: 1px solid var(--swatch);
		border-radius: var(--radius);
		color: var(--swatch);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.body {
		display: grid;
		gap: 2px;
		min-width: 0;
	}

	.original {
		display: flex;
		gap: 10px;
		align-items: baseline;
		font-size: 0.8125rem;
		line-height: 1.4;
	}

	.time {
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.new {
		font-size: 1.0625rem;
		line-height: 1.4;
		padding: 2px 0;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 24px;
	}

	.make {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		color: var(--accent);
	}
</style>
