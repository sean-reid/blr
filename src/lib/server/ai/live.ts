import type { AiClient, NovaResponse } from './types';

const RETRY_MS = 400;

// Workers AI occasionally answers 8008 or another server-side error; one
// retry after a short pause clears it.
export async function withRetry<T>(run: () => Promise<T>, wait = RETRY_MS): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (!/AiError: 800\d|internal server error|timed out|\b50[023]\b/i.test(String(e))) throw e;
		await new Promise((r) => setTimeout(r, wait));
		return run();
	}
}

export function liveClient(ai: Ai): AiClient {
	return {
		async transcribe(audio, contentType) {
			return (await ai.run('@cf/deepgram/nova-3', {
				audio: { body: audio, contentType },
				diarize: true,
				punctuate: true,
				smart_format: true,
				utterances: true,
				language: 'en'
			})) as unknown as NovaResponse;
		},
		async chatJson(req) {
			const out = (await withRetry(() =>
				ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
					messages: [
						{ role: 'system', content: req.system },
						{ role: 'user', content: req.user }
					],
					max_tokens: req.maxTokens,
					temperature: req.temperature,
					response_format: { type: 'json_schema', json_schema: req.schema }
				})
			)) as { response?: unknown };
			const r = out.response;
			return typeof r === 'string' ? JSON.parse(r) : r;
		},
		async speak(text, voice) {
			const body = (await withRetry(() =>
				ai.run('@cf/deepgram/aura-1', {
					text,
					speaker: voice as Ai_Cf_Deepgram_Aura_1_Input['speaker'],
					encoding: 'linear16',
					container: 'wav',
					sample_rate: 24000
				})
			)) as unknown as ReadableStream<Uint8Array>;
			return { body, contentType: 'audio/wav' };
		}
	};
}
