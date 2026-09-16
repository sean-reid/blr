<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Nothing here</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="missing">
	<h1>{page.status === 404 ? 'Nothing here.' : 'Something went wrong.'}</h1>
	<p class="muted">
		{page.status === 404
			? 'This link has expired or never existed. Shared videos last seven days.'
			: page.error?.message}
	</p>
	<a href={resolve('/')} class="make">Make your own</a>
</section>

<style>
	.missing {
		display: grid;
		gap: 8px;
		padding-block: 24px;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.make {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		justify-self: start;
		color: var(--accent);
	}
</style>
