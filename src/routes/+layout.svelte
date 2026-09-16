<script lang="ts">
	import '$lib/styles/app.css';
	import { onMount } from 'svelte';
	import { initTheme } from '$lib/theme.svelte';

	let { children } = $props();

	onMount(initTheme);
</script>

<svelte:head>
	<meta name="theme-color" content="#f5f1ea" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#14120f" media="(prefers-color-scheme: dark)" />
</svelte:head>

{@render children()}
