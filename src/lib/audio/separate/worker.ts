import { KIM_VOCAL_2, separateStems } from './mdx.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';
import { createSession, type ModelSession } from './session.ts';

let session: ModelSession | null = null;
const running = new Map<number, AbortController>();

function post(msg: WorkerResponse, transfer: ArrayBuffer[] = []) {
	self.postMessage(msg, { transfer });
}

function fail(err: unknown, id?: number) {
	post({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
}

async function handle(msg: WorkerRequest) {
	switch (msg.type) {
		case 'load': {
			await session?.release();
			session = await createSession(
				msg.model,
				msg.providers,
				[1, 4, KIM_VOCAL_2.dimF, KIM_VOCAL_2.dimT],
				msg.runtimeUrl
			);
			post({ type: 'loaded', provider: session.provider });
			return;
		}
		case 'separate': {
			if (!session) throw new Error('Model is not loaded');
			const ctl = new AbortController();
			running.set(msg.id, ctl);
			try {
				const stems = await separateStems(msg.mix, session, KIM_VOCAL_2, {
					overlap: msg.overlap,
					signal: ctl.signal,
					onProgress: (done, total) => post({ type: 'progress', id: msg.id, done, total })
				});
				const buffers = [...stems.instrumental, ...stems.vocals].map(
					(ch) => ch.buffer as ArrayBuffer
				);
				post({ type: 'result', id: msg.id, ...stems }, buffers);
			} finally {
				running.delete(msg.id);
			}
			return;
		}
		case 'cancel':
			running.get(msg.id)?.abort();
			return;
		case 'dispose':
			await session?.release();
			session = null;
			self.close();
	}
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
	const id = 'id' in e.data ? e.data.id : undefined;
	handle(e.data).catch((err) => fail(err, id));
};
