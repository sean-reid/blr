import type { AiClient, NovaResponse } from './types';

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
			const out = (await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
				messages: [
					{ role: 'system', content: req.system },
					{ role: 'user', content: req.user }
				],
				max_tokens: req.maxTokens,
				temperature: req.temperature,
				response_format: { type: 'json_schema', json_schema: req.schema }
			})) as { response?: unknown };
			const r = out.response;
			return typeof r === 'string' ? JSON.parse(r) : r;
		}
	};
}
