<script lang="ts">
	let { label, fraction = null }: { label: string; fraction?: number | null } = $props();
</script>

<div class="progress" role="status" aria-live="polite">
	{#if fraction === null}
		<div class="bar sweep"></div>
	{:else}
		<div class="bar" style:transform="scaleX({Math.max(0.02, Math.min(1, fraction))})"></div>
	{/if}
	<p class="label">{label}</p>
</div>

<style>
	.progress {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgb(20 18 15 / 45%);
		border-radius: var(--radius);
	}

	.bar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--accent);
		transform-origin: left;
		transition: transform var(--t-fast) linear;
	}

	.sweep {
		animation: sweep 1.6s var(--ease) infinite;
	}

	.label {
		color: #f5f1ea;
		font-size: 1.125rem;
		letter-spacing: -0.01em;
	}

	@keyframes sweep {
		0% {
			transform: scaleX(0);
		}
		60% {
			transform: scaleX(1);
			transform-origin: left;
		}
		61% {
			transform-origin: right;
		}
		100% {
			transform: scaleX(0);
			transform-origin: right;
		}
	}
</style>
