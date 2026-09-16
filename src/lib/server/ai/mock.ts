import type { AiClient, NovaResponse } from './types';
import type { RewriteResponse } from '../../rewrite/types';
import sample from '../fixtures/nova-sample.json';
import rewrite from '../fixtures/rewrite-sample.json';
import speech from '../fixtures/speech-sample.json';
import { placeholderSpeech } from './placeholder';

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
			const heads = [...req.user.matchAll(/^Line (\S+), speaker \d+[^"]*: "(.*)"$/gm)];
			const known = new Map((rewrite as RewriteResponse).lines.map((l) => [l.id, l.options]));
			return {
				lines: heads.map(([, id, original]) => ({ id, options: known.get(id) ?? [original] }))
			};
		},
		async speak(text, voice) {
			const table = speech as Record<string, string>;
			const key =
				`${voice}|${text}` in table
					? `${voice}|${text}`
					: Object.keys(table).find((k) => k.slice(k.indexOf('|') + 1) === text);
			if (key) return { body: decode(table[key]), contentType: 'audio/mpeg' };
			return { body: placeholderSpeech(text), contentType: 'audio/wav' };
		}
	};
}

function decode(b64: string): ArrayBuffer {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes.buffer;
}
