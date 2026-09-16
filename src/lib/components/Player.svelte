<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Pcm } from '$lib/audio/mix';
	import { toAudioBuffer } from '$lib/voice/render';

	let {
		src,
		mixed = null,
		useMixed = false,
		ontime,
		video = $bindable<HTMLVideoElement | null>(null)
	}: {
		src: string;
		mixed?: Pcm | null;
		useMixed?: boolean;
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
		source.start(0, video.currentTime);
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

<!-- svelte-ignore a11y_media_has_caption -->
<video
	bind:this={video}
	{src}
	controls
	playsinline
	preload="metadata"
	data-audio={useMixed && mixed ? 'new' : 'original'}
	onplay={start}
	onpause={stop}
	onseeking={() => {
		if (video && !video.paused) start();
	}}
	onended={stop}
	ontimeupdate={(e) => ontime?.(e.currentTarget.currentTime)}
></video>

<style>
	video {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		border-radius: var(--radius);
	}
</style>
