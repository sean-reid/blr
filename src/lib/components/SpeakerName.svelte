<script lang="ts">
	import { speakerLetter, speakerName, type Names } from '$lib/transcript/names';

	let {
		speaker,
		names,
		size = 'row',
		onrename
	}: {
		speaker: number;
		names: Names;
		size?: 'row' | 'picker';
		onrename?: (speaker: number, name: string) => void;
	} = $props();

	let editing = $state(false);
	let label = $derived(speakerName(speaker, names));
	let letter = $derived(speakerLetter(speaker));

	function commit(e: Event) {
		onrename?.(speaker, (e.currentTarget as HTMLInputElement).value);
		editing = false;
	}
</script>

{#if editing}
	<!-- svelte-ignore a11y_autofocus -->
	<input
		class="rename {size}"
		type="text"
		value={names[speaker] ?? ''}
		placeholder={letter}
		maxlength="24"
		aria-label="Name for speaker {letter}"
		autofocus
		onfocus={(e) => e.currentTarget.select()}
		onblur={commit}
		onkeydown={(e) => {
			if (e.key === 'Enter') commit(e);
			if (e.key === 'Escape') editing = false;
		}}
	/>
{:else}
	<button
		type="button"
		class="name {size}"
		class:named={label !== letter}
		aria-label="Rename speaker {letter}"
		title={label}
		onclick={() => (editing = true)}
	>
		{label}
	</button>
{/if}

<style>
	.name,
	.rename {
		height: 32px;
		min-width: 32px;
		max-width: 12ch;
		padding: 0;
		border: 1px solid var(--swatch);
		border-radius: var(--radius);
		color: var(--swatch);
		background: transparent;
		font-size: 0.8125rem;
		font-weight: 600;
		text-align: center;
	}

	.name {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name.named {
		padding: 0 6px;
	}

	.name:hover {
		background: color-mix(in srgb, var(--swatch) 10%, transparent);
	}

	.rename {
		width: 12ch;
		max-width: none;
		outline: none;
	}

	.rename:focus {
		border-color: var(--ink);
	}

	.rename::placeholder {
		color: var(--swatch);
		opacity: 0.5;
	}

	.picker {
		height: 24px;
		min-width: 24px;
		font-size: 0.75rem;
	}
</style>
