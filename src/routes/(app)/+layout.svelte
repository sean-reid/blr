<script lang="ts">
	import { theme, toggleTheme } from '$lib/theme.svelte';
	import About from '$lib/components/About.svelte';
	import { resolve } from '$app/paths';

	let { children } = $props();
	let aboutOpen = $state(false);
</script>

<svelte:head>
	<title>BLR</title>
	<meta name="description" content="Bad lip reading generator. Runs in your browser." />
	<meta property="og:site_name" content="BLR" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="BLR" />
	<meta property="og:description" content="Bad lip reading generator. Runs in your browser." />
	<meta property="og:url" content="https://blr.dwainosaur.com/" />
	<meta property="og:image" content="https://blr.dwainosaur.com/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href="https://blr.dwainosaur.com/" />
</svelte:head>

<header>
	<a href={resolve('/')} class="wordmark" aria-label="BLR home">BLR</a>
	<button
		type="button"
		class="plain"
		aria-expanded={aboutOpen}
		aria-controls="about"
		onclick={() => (aboutOpen = !aboutOpen)}
	>
		About
	</button>
</header>

{#if aboutOpen}
	<About id="about" onclose={() => (aboutOpen = false)} />
{/if}

<main>
	{@render children()}
</main>

<footer>
	<p class="muted">Your video stays in this tab. Only the audio is sent out, for transcription.</p>
	<nav>
		<button type="button" class="plain" onclick={toggleTheme}>
			{theme.value === 'dark' ? 'Light' : 'Dark'}
		</button>
		<a href="https://github.com/sean-reid/blr" rel="noopener">Source</a>
	</nav>
</footer>

<style>
	header,
	main,
	footer {
		width: 100%;
		max-width: calc(var(--measure) + 2 * var(--gutter));
		margin: 0 auto;
		padding-inline: var(--gutter);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 64px;
	}

	.wordmark {
		font-weight: 700;
		font-size: 1.125rem;
		letter-spacing: -0.02em;
		text-decoration: none;
	}

	.plain {
		min-height: var(--tap);
		padding-inline: 4px;
		color: var(--ink-muted);
		transition: color var(--t-fast) var(--ease);
	}

	.plain:hover,
	.plain[aria-expanded='true'] {
		color: var(--ink);
	}

	main {
		flex: 1;
		padding-block: 8px 48px;
	}

	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding-block: 16px;
		border-top: 1px solid var(--ink-hairline);
		font-size: 0.875rem;
	}

	footer nav {
		display: flex;
		align-items: center;
		gap: 20px;
		flex-shrink: 0;
	}

	footer a {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
	}

	@media (max-width: 480px) {
		footer {
			flex-direction: column;
			align-items: flex-start;
			gap: 4px;
		}
	}
</style>
