<script lang="ts">
	import type { Line } from '$lib/transcript/types';

	let {
		lines,
		current = null,
		onseek
	}: { lines: Line[]; current?: string | null; onseek?: (t: number) => void } = $props();

	const letters = 'ABCDEFGH';

	function fmt(s: number) {
		const m = Math.floor(s / 60);
		const r = s - m * 60;
		return `${m}:${r.toFixed(1).padStart(4, '0')}`;
	}
</script>

<ol class="lines">
	{#each lines as line (line.id)}
		<li
			class:current={line.id === current}
			style:--swatch="var(--speaker-{'abcdefgh'[line.speaker] ?? 'a'})"
		>
			<button type="button" class="speaker" aria-label="Speaker {letters[line.speaker] ?? '?'}">
				{letters[line.speaker] ?? '?'}
			</button>
			<button type="button" class="body" onclick={() => onseek?.(line.start)}>
				<span class="time mono muted">{fmt(line.start)}</span>
				<span class="text">{line.text}</span>
			</button>
		</li>
	{/each}
</ol>

<style>
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
		text-align: left;
		min-height: var(--tap);
	}

	.body:hover .text {
		text-decoration: underline;
		text-underline-offset: 0.16em;
		text-decoration-color: var(--ink-faint);
	}

	.current .text {
		color: var(--accent);
	}

	.time {
		font-size: 0.75rem;
	}

	.text {
		font-size: 1rem;
		line-height: 1.4;
	}
</style>
