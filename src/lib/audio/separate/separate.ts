import type { Stems, Stereo } from './mdx.ts';
import {
	DEFAULT_PROVIDERS,
	type Provider,
	type WorkerRequest,
	type WorkerResponse
} from './protocol.ts';
import workerUrl from './worker.ts?worker&url';

/** Static assets may lack the COEP header the isolated page demands, so the built worker is loaded as a blob. */
async function spawnWorker(): Promise<Worker> {
	if (import.meta.env.DEV) return new Worker(workerUrl, { type: 'module' });
	const source = await (await fetch(workerUrl)).blob();
	return new Worker(URL.createObjectURL(source), { type: 'module' });
}

export type { Provider, Stems, Stereo };

export interface LoadOptions {
	providers?: Provider[];
	/** Directory URL holding the onnxruntime-web .wasm binary. Defaults to the pinned CDN copy. */
	runtimeUrl?: string;
	onDownload?: (loaded: number, total: number | null) => void;
}

export interface SeparateOptions {
	overlap?: number;
	onProgress?: (done: number, total: number) => void;
	signal?: AbortSignal;
}

async function download(url: string, onProgress?: LoadOptions['onDownload']): Promise<ArrayBuffer> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Model download failed: ${res.status} ${res.statusText}`);
	if (!res.body || !onProgress) return res.arrayBuffer();
	const length = Number(res.headers.get('content-length')) || null;
	const parts: Uint8Array[] = [];
	let loaded = 0;
	const reader = res.body.getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		parts.push(value);
		loaded += value.byteLength;
		onProgress(loaded, length);
	}
	const out = new Uint8Array(loaded);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.byteLength;
	}
	return out.buffer;
}

/** Runs MDX-Net vocal separation in a dedicated worker. */
export class VocalSeparator {
	private worker: Worker;
	private nextId = 1;
	private pending = new Map<
		number,
		{
			resolve: (s: Stems) => void;
			reject: (e: Error) => void;
			onProgress?: SeparateOptions['onProgress'];
		}
	>();
	readonly provider: Provider;

	private constructor(worker: Worker, provider: Provider) {
		this.worker = worker;
		this.provider = provider;
		worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.receive(e.data);
		worker.onerror = (e) => this.failAll(new Error(e.message || 'Separation worker crashed'));
	}

	/** Downloads the model (or accepts its bytes) and brings up a session on the first working provider. */
	static async load(
		model: string | ArrayBuffer,
		options: LoadOptions = {}
	): Promise<VocalSeparator> {
		const bytes = typeof model === 'string' ? await download(model, options.onDownload) : model;
		const worker = await spawnWorker();
		const provider = await new Promise<Provider>((resolve, reject) => {
			worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
				if (e.data.type === 'loaded') resolve(e.data.provider);
				else if (e.data.type === 'error') reject(new Error(e.data.message));
			};
			worker.onerror = (e) => reject(new Error(e.message || 'Separation worker failed to start'));
			const msg: WorkerRequest = {
				type: 'load',
				model: bytes,
				providers: options.providers ?? DEFAULT_PROVIDERS,
				runtimeUrl: options.runtimeUrl
			};
			worker.postMessage(msg, [bytes]);
		}).catch((err) => {
			worker.terminate();
			throw err;
		});
		return new VocalSeparator(worker, provider);
	}

	/** Separates a stereo 44.1 kHz mix. The input arrays are transferred and unusable afterwards. */
	separate(mix: Stereo, { overlap, onProgress, signal }: SeparateOptions = {}): Promise<Stems> {
		const id = this.nextId++;
		return new Promise<Stems>((resolve, reject) => {
			this.pending.set(id, { resolve, reject, onProgress });
			signal?.addEventListener('abort', () => this.send({ type: 'cancel', id }), { once: true });
			this.send({ type: 'separate', id, mix, overlap }, [
				mix[0].buffer as ArrayBuffer,
				mix[1].buffer as ArrayBuffer
			]);
		});
	}

	dispose() {
		this.send({ type: 'dispose' });
		this.failAll(new Error('Separator disposed'));
	}

	private send(msg: WorkerRequest, transfer: ArrayBuffer[] = []) {
		this.worker.postMessage(msg, transfer);
	}

	private receive(msg: WorkerResponse) {
		if (msg.type === 'loaded') return;
		const id = msg.id;
		if (id === undefined) {
			this.failAll(new Error(msg.type === 'error' ? msg.message : 'Malformed worker message'));
			return;
		}
		const entry = this.pending.get(id);
		if (!entry) return;
		if (msg.type === 'progress') {
			entry.onProgress?.(msg.done, msg.total);
			return;
		}
		this.pending.delete(id);
		if (msg.type === 'result')
			entry.resolve({ instrumental: msg.instrumental, vocals: msg.vocals });
		else entry.reject(new Error(msg.message));
	}

	private failAll(err: Error) {
		for (const entry of this.pending.values()) entry.reject(err);
		this.pending.clear();
	}
}
