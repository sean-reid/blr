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
		}
	};
}
