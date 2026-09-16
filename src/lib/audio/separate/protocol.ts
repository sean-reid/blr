import type { Stereo } from './mdx.ts';

export type Provider = 'webgpu' | 'wasm';

export const DEFAULT_PROVIDERS: Provider[] = ['webgpu', 'wasm'];

export type WorkerRequest =
	| { type: 'load'; model: ArrayBuffer; providers: Provider[]; runtimeUrl?: string }
	| { type: 'separate'; id: number; mix: Stereo; overlap?: number }
	| { type: 'cancel'; id: number }
	| { type: 'dispose' };

export type WorkerResponse =
	| { type: 'loaded'; provider: Provider }
	| { type: 'progress'; id: number; done: number; total: number }
	| { type: 'result'; id: number; instrumental: Stereo; vocals: Stereo }
	| { type: 'error'; id?: number; message: string };
