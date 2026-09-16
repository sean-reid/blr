import * as ort from 'onnxruntime-web';
import type { ModelRunner } from './mdx.ts';
import type { Provider } from './protocol.ts';

/** Where the onnxruntime .wasm binary and its loader are fetched from when no runtime URL is given. */
export function defaultRuntimeUrl(): string {
	return `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
}

export interface ModelSession extends ModelRunner {
	provider: Provider;
	release(): Promise<void>;
}

/** Creates a session on the first provider that accepts the model and completes a warm-up run. */
export async function createSession(
	model: ArrayBuffer,
	providers: Provider[],
	dims: readonly number[],
	runtimeUrl = defaultRuntimeUrl()
): Promise<ModelSession> {
	ort.env.wasm.wasmPaths = runtimeUrl;
	const bytes = new Uint8Array(model);
	const errors: string[] = [];
	for (const provider of providers) {
		if (provider === 'webgpu' && !('gpu' in navigator)) {
			errors.push('webgpu: navigator.gpu is unavailable');
			continue;
		}
		let session: ort.InferenceSession | undefined;
		try {
			session = await ort.InferenceSession.create(bytes, {
				executionProviders: [provider],
				graphOptimizationLevel: 'all'
			});
			const inputName = session.inputNames[0];
			const outputName = session.outputNames[0];
			const run = async (input: Float32Array) => {
				const feeds = { [inputName]: new ort.Tensor('float32', input, dims) };
				const out = await session!.run(feeds);
				const tensor = out[outputName];
				const data = tensor.data as Float32Array;
				tensor.dispose?.();
				return data;
			};
			await run(new Float32Array(dims.reduce((a, b) => a * b, 1)));
			return { provider, run, release: () => session!.release() };
		} catch (err) {
			await session?.release().catch(() => {});
			errors.push(`${provider}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	throw new Error(`No execution provider could run the model. ${errors.join(' | ')}`);
}
