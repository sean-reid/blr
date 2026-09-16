<script lang="ts">
	let { id, onclose }: { id: string; onclose: () => void } = $props();
</script>

<section {id} class="about">
	<p>
		BLR rewrites what people say in a video into lines that make the same mouth shapes, then voices
		the new lines and mixes them over the original background sound.
	</p>
	<p>
		The video never leaves your browser. Vocal separation and the final mix happen on your machine.
		Only the audio goes out, once, to be transcribed.
	</p>
	<p>
		Nothing is stored unless you choose to share, and shared videos are removed after seven days.
	</p>
	<button type="button" class="close" onclick={onclose}>Close</button>
</section>

<style>
	.about {
		width: 100%;
		max-width: calc(var(--measure) + 2 * var(--gutter));
		margin: 0 auto 24px;
		padding: 20px var(--gutter);
		border-top: 1px solid var(--ink-hairline);
		border-bottom: 1px solid var(--ink-hairline);
		display: grid;
		gap: 12px;
		font-size: 0.9375rem;
		max-width: calc(var(--measure) + 2 * var(--gutter));
	}

	.about p {
		max-width: 56ch;
	}

	.close {
		justify-self: start;
		min-height: var(--tap);
		color: var(--ink-muted);
	}

	.close:hover {
		color: var(--ink);
	}
</style>
