import type { AiClient, NovaResponse } from './types';
import type { RewriteResponse } from '$lib/rewrite/types';
import sample from '../fixtures/nova-sample.json';
import rewrite from '../fixtures/rewrite-sample.json';

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
		},
		async chatJson(req) {
			const heads = [
				...req.user.matchAll(/^Line (\S+), speaker \d+, \d+ syllables, original: "(.*)"$/gm)
			];
			const known = new Map((rewrite as RewriteResponse).lines.map((l) => [l.id, l.options]));
			return {
				lines: heads.map(([, id, original]) => ({ id, options: known.get(id) ?? [original] }))
			};
		}
	};
}
