import type { AiClient, NovaResponse } from './types';
import sample from '../fixtures/nova-sample.json';

// Drains the body so the mock exercises the same request path as live.
async function drain(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();
	while (!(await reader.read()).done) {
		/* discard */
	}
}

export function mockClient(): AiClient {
	return {
		async transcribe(audio) {
			await drain(audio);
			return structuredClone(sample) as NovaResponse;
		}
	};
}
