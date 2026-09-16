<script lang="ts">
	import { resolve } from '$app/paths';

	let { children } = $props();
</script>

<header>
	<a href={resolve('/')} class="wordmark" aria-label="BLR home">BLR</a>
</header>

<main>
	{@render children()}
</main>

<style>
	header,
	main {
		width: 100%;
		max-width: calc(var(--measure) + 2 * var(--gutter));
		margin: 0 auto;
		padding-inline: var(--gutter);
	}

	header {
		display: flex;
		align-items: center;
		height: 64px;
	}

	.wordmark {
		font-weight: 700;
		font-size: 1.125rem;
		letter-spacing: -0.02em;
		text-decoration: none;
	}

	main {
		flex: 1;
		padding-block: 8px 48px;
	}
</style>
