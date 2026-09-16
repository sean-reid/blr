import { liveClient } from './live';
import { mockClient } from './mock';
import type { AiClient } from './types';

export type { AiClient, NovaResponse, NovaWord } from './types';

export function aiClient(platform: App.Platform | undefined): AiClient {
	const env = platform?.env;
	if (env?.AI_MODE === 'live' && env.AI) return liveClient(env.AI);
	return mockClient();
}
