<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Pcm } from '$lib/audio/mix';
	import { toAudioBuffer } from '$lib/voice/render';
	import type { Range } from '$lib/media/range';

	export interface Caption {
		text: string;
		label: string;
		speaker: number;
	}

	let {
		src,
		mixed = null,
		useMixed = false,
		range = null,
		caption = null,
		ontime,
		video = $bindable<HTMLVideoElement | null>(null)
	}: {
		src: string;
		mixed?: Pcm | null;
		useMixed?: boolean;
		range?: Range | null;
		caption?: Caption | null;
		ontime?: (t: number) => void;
		video?: HTMLVideoElement | null;
	} = $props();

	let ctx: AudioContext | null = null;
	let buffer: AudioBuffer | null = null;
	let source: AudioBufferSourceNode | null = null;
	let bufferFor: Pcm | null = null;

	function ensureBuffer() {
		ctx ??= new AudioContext();
		if (mixed && bufferFor !== mixed) {
			buffer = toAudioBuffer(ctx, mixed);
			bufferFor = mixed;
		}
	}

	function stop() {
		source?.stop();
		source?.disconnect();
		source = null;
	}

	function start() {
		if (!video || !useMixed || !mixed) return;
		ensureBuffer();
		if (!ctx || !buffer) return;
		stop();
		source = ctx.createBufferSource();
		source.buffer = buffer;
		source.connect(ctx.destination);
		source.start(0, Math.max(0, video.currentTime - (range?.start ?? 0)));
		if (ctx.state === 'suspended') ctx.resume();
	}

	$effect(() => {
		if (!video) return;
		video.muted = useMixed && !!mixed;
		if (useMixed && !video.paused) start();
		else stop();
	});

	onDestroy(() => {
		stop();
		ctx?.close();
	});
</script>

<div class="player">
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={video}
		{src}
		controls
		playsinline
		preload="metadata"
		data-audio={useMixed && mixed ? 'new' : 'original'}
		onplay={() => {
			if (video && range && (video.currentTime < range.start || video.currentTime >= range.end)) {
				video.currentTime = range.start;
			}
			start();
		}}
		onpause={stop}
		onseeking={() => {
			if (video && !video.paused) start();
		}}
		onended={stop}
		ontimeupdate={(e) => {
			const t = e.currentTarget.currentTime;
			if (range && t >= range.end && !e.currentTarget.paused) e.currentTarget.pause();
			ontime?.(t);
		}}
	></video>
	{#if caption}
		<p
			class="caption"
			aria-live="off"
			style:--swatch="var(--speaker-{'abcdefgh'[caption.speaker] ?? 'a'})"
		>
			<span class="who">{caption.label}</span>
			<span class="text">{caption.text}</span>
		</p>
	{/if}
</div>

<style>
	.player {
		position: relative;
	}

	video {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		border-radius: var(--radius);
	}

	.caption {
		position: absolute;
		left: 50%;
		bottom: clamp(56px, 14%, 72px);
		transform: translateX(-50%);
		max-width: calc(100% - 32px);
		display: flex;
		gap: 8px;
		align-items: baseline;
		padding: 4px 10px;
		background: rgb(20 18 15 / 85%);
		color: #f5f1ea;
		border-radius: var(--radius);
		font-size: clamp(0.875rem, 2.6vw, 1.0625rem);
		line-height: 1.4;
		white-space: nowrap;
		pointer-events: none;
	}

	.who {
		flex-shrink: 0;
		max-width: 12ch;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--swatch);
		font-weight: 600;
		font-size: 0.8125rem;
	}

	.text {
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
