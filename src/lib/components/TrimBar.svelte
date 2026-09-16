<script lang="ts">
	import { clampRange, fmtClock, MAX_SECONDS, type Range } from '$lib/media/range';

	let {
		duration,
		range = $bindable(),
		onscrub,
		onuse
	}: {
		duration: number;
		range: Range;
		onscrub?: (t: number) => void;
		onuse: () => void;
	} = $props();

	let track: HTMLDivElement;
	let dragging = $state<'start' | 'end' | 'window' | null>(null);
	let grabOffset = 0;

	const pct = (t: number) => `${(100 * t) / duration}%`;

	function timeAt(clientX: number) {
		const box = track.getBoundingClientRect();
		return Math.max(0, Math.min(duration, ((clientX - box.left) / box.width) * duration));
	}

	function set(next: Range, scrub: number) {
		range = clampRange(next, duration);
		onscrub?.(scrub);
	}

	function down(handle: 'start' | 'end' | 'window', e: PointerEvent) {
		dragging = handle;
		grabOffset = timeAt(e.clientX) - range.start;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function move(e: PointerEvent) {
		if (!dragging) return;
		const t = timeAt(e.clientX);
		if (dragging === 'start') set({ start: Math.min(t, range.end - 1), end: range.end }, t);
		else if (dragging === 'end') set({ start: range.start, end: Math.max(t, range.start + 1) }, t);
		else {
			const len = range.end - range.start;
			const start = Math.max(0, Math.min(duration - len, t - grabOffset));
			set({ start, end: start + len }, start);
		}
	}

	function key(handle: 'start' | 'end', e: KeyboardEvent) {
		const step = e.shiftKey ? 10 : 1;
		const delta = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
		if (!delta) return;
		e.preventDefault();
		if (handle === 'start')
			set({ start: range.start + delta, end: range.end }, range.start + delta);
		else set({ start: range.start, end: range.end + delta }, range.end + delta);
	}
</script>

<div class="trim">
	<p class="hint muted">
		This video runs {fmtClock(duration)}. Pick up to {fmtClock(MAX_SECONDS)} of it.
	</p>
	<div class="track" bind:this={track} onpointermove={move} onpointerup={() => (dragging = null)}>
		<div
			class="window"
			style:left={pct(range.start)}
			style:width={pct(range.end - range.start)}
			onpointerdown={(e) => down('window', e)}
		></div>
		<div
			class="handle start"
			role="slider"
			tabindex="0"
			aria-label="Start"
			aria-valuemin={0}
			aria-valuemax={duration}
			aria-valuenow={range.start}
			aria-valuetext={fmtClock(range.start)}
			style:left={pct(range.start)}
			onpointerdown={(e) => down('start', e)}
			onkeydown={(e) => key('start', e)}
		></div>
		<div
			class="handle end"
			role="slider"
			tabindex="0"
			aria-label="End"
			aria-valuemin={0}
			aria-valuemax={duration}
			aria-valuenow={range.end}
			aria-valuetext={fmtClock(range.end)}
			style:left={pct(range.end)}
			onpointerdown={(e) => down('end', e)}
			onkeydown={(e) => key('end', e)}
		></div>
	</div>
	<div class="row">
		<span class="mono muted"
			>{fmtClock(range.start)} to {fmtClock(range.end)}, {fmtClock(range.end - range.start)}</span
		>
		<button type="button" class="primary" onclick={onuse}>Use this part</button>
	</div>
</div>

<style>
	.trim {
		display: grid;
		gap: 12px;
	}

	.hint {
		font-size: 0.9375rem;
	}

	.track {
		position: relative;
		height: 44px;
		border-top: 1px solid var(--ink-hairline);
		border-bottom: 1px solid var(--ink-hairline);
		touch-action: none;
		user-select: none;
	}

	.window {
		position: absolute;
		top: 0;
		bottom: 0;
		background: rgb(211 64 31 / 12%);
		border-left: 2px solid var(--accent);
		border-right: 2px solid var(--accent);
		cursor: grab;
	}

	.handle {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 44px;
		margin-left: -22px;
		cursor: ew-resize;
		border-radius: var(--radius);
	}

	.handle:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.primary {
		min-height: var(--tap);
		padding: 0 20px;
		background: var(--accent);
		color: var(--accent-ink);
		border-radius: var(--radius);
		font-weight: 600;
	}
</style>
