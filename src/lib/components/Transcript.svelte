<script lang="ts">
	import type { Line } from '$lib/transcript/types';
	import type { Ranked } from '$lib/rewrite/client';

	let {
		lines,
		rewrites,
		current = null,
		onseek,
		onreroll,
		onedit
	}: {
		lines: Line[];
		rewrites: Record<string, { current: Ranked | null; busy: boolean }>;
		current?: string | null;
		onseek?: (t: number) => void;
		onreroll?: (id: string) => void;
		onedit?: (id: string, text: string) => void;
	} = $props();

	const letters = 'ABCDEFGH';
	let editing = $state<string | null>(null);

	function fmt(s: number) {
		const m = Math.floor(s / 60);
		const r = s - m * 60;
		return `${m}:${r.toFixed(1).padStart(4, '0')}`;
	}

	function shade(score: number) {
		return score < 0.34 ? 'far' : 'fit';
	}

	function commit(id: string, e: Event) {
		onedit?.(id, (e.currentTarget as HTMLInputElement).value);
		editing = null;
	}
</script>

<ol class="lines">
	{#each lines as line, i (line.id)}
		{@const rw = rewrites[line.id]}
		{@const words = rw?.current ? rw.current.text.split(' ') : []}
		{@const sc = rw?.current?.perWord ?? []}
		<li
			class:current={line.id === current}
			style:--swatch="var(--speaker-{'abcdefgh'[line.speaker] ?? 'a'})"
		>
			<button type="button" class="speaker" aria-label="Speaker {letters[line.speaker] ?? '?'}">
				{letters[line.speaker] ?? '?'}
			</button>
			<div class="body">
				<button type="button" class="original" onclick={() => onseek?.(line.start)}>
					<span class="time mono muted">{fmt(line.start)}</span>
					<span class="muted">{line.text}</span>
				</button>
				{#if rw && !rw.current}
					<p class="empty muted">Nothing yet.</p>
				{:else if rw?.current}
					{#if editing === line.id}
						<!-- svelte-ignore a11y_autofocus -->
						<input
							class="edit"
							type="text"
							value={rw.current.text}
							aria-label="New line {i + 1}"
							autofocus
							onblur={(e) => commit(line.id, e)}
							onkeydown={(e) => {
								if (e.key === 'Enter') commit(line.id, e);
								if (e.key === 'Escape') editing = null;
							}}
						/>
					{:else}
						<button
							type="button"
							class="new"
							class:busy={rw.busy}
							aria-label="Edit new line {i + 1}"
							onclick={() => (editing = line.id)}
						>
							{#each words as w, j (j)}
								<span
									class="w {shade(sc[j] ?? 0)}"
									title={sc[j] !== undefined && sc[j] < 0.99
										? `Mouth match ${Math.round((sc[j] ?? 0) * 100)}%`
										: undefined}>{w + ' '}</span
								>
							{/each}
						</button>
					{/if}
				{/if}
			</div>
			<button
				type="button"
				class="reroll mono"
				aria-label="Reroll line {i + 1}"
				disabled={!rw || rw.busy}
				class:muted={!rw?.current}
				onclick={() => onreroll?.(line.id)}
			>
				{rw?.busy ? '…' : 'Reroll'}
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
		grid-template-columns: 32px 1fr auto;
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
		text-align: left;
		font-size: 0.8125rem;
		line-height: 1.4;
	}

	.original:hover span:last-child {
		color: var(--ink);
	}

	.time {
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.new {
		display: block;
		text-align: left;
		font-size: 1.0625rem;
		line-height: 1.4;
		min-height: 28px;
		padding: 2px 0;
		transition: opacity var(--t-fast) var(--ease);
	}

	.new.busy {
		opacity: 0.4;
	}

	.new:hover {
		text-decoration: underline;
		text-underline-offset: 0.16em;
		text-decoration-color: var(--ink-faint);
	}

	.w.far {
		text-decoration: underline dotted var(--accent);
		text-underline-offset: 0.18em;
	}

	.empty {
		font-size: 1.0625rem;
		line-height: 1.4;
		padding: 2px 0;
	}

	.edit {
		width: 100%;
		font-size: 1.0625rem;
		line-height: 1.4;
		padding: 2px 0;
		border: 0;
		border-bottom: 1px solid var(--ink);
		background: transparent;
		outline: none;
	}

	.current .new {
		color: var(--accent);
	}

	.reroll {
		align-self: start;
		min-height: var(--tap);
		padding-inline: 4px;
		color: var(--ink-muted);
	}

	.reroll:hover:not(:disabled) {
		color: var(--ink);
	}

	.reroll:disabled {
		cursor: default;
	}
</style>
