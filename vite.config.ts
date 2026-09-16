import { defineConfig, type Plugin } from 'vitest/config';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

const isolationHeaders = {
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Embedder-Policy': 'require-corp'
};

/**
 * onnxruntime-web resolves its 28 MB .wasm relative to import.meta.url as a fallback,
 * which Vite would copy into the build and Cloudflare would reject (25 MiB asset cap).
 * The runtime is fetched from env.wasm.wasmPaths instead, so the fallback is retargeted.
 */
function ortExternalWasm(): Plugin {
	return {
		name: 'ort-external-wasm',
		enforce: 'pre',
		transform(code, id) {
			if (!id.includes('onnxruntime-web')) return;
			return code.replace(
				/new URL\((["'])(ort-wasm[^"']*)\1,\s*import\.meta\.url\)/g,
				'new URL("$2", self.location.href)'
			);
		}
	};
}

export default defineConfig({
	plugins: [
		ortExternalWasm(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter({
				platformProxy: {
					configPath: process.env.BLR_LIVE ? 'wrangler.jsonc' : 'wrangler.dev.jsonc'
				}
			}),
			version: { pollInterval: 60_000 }
		})
	],
	worker: { plugins: () => [ortExternalWasm()] },
	server: { headers: isolationHeaders },
	preview: { headers: isolationHeaders },
	optimizeDeps: { exclude: ['onnxruntime-web'] },
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
