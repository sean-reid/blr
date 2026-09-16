<script lang="ts">
	import '$lib/styles/app.css';
	import { onMount } from 'svelte';
	import { initTheme } from '$lib/theme.svelte';

	let { children } = $props();

	onMount(initTheme);
</script>

<svelte:head>
	<title>BLR</title>
	<meta name="description" content="Bad lip reading generator. Runs in your browser." />
</svelte:head>

{@render children()}
