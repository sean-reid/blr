import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiClient } from '$lib/server/ai';
import { VOICE_IDS } from '$lib/voice/voices';

const MAX_CHARS = 300;

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = (await request.json().catch(() => null)) as {
		text?: unknown;
		voice?: unknown;
	} | null;
	const text = typeof body?.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : '';
	const voice = typeof body?.voice === 'string' ? body.voice : '';
	if (!text) error(400, 'Nothing to say.');
	if (text.length > MAX_CHARS) error(400, 'Line too long.');
	if (!VOICE_IDS.has(voice)) error(400, 'Unknown voice.');
	const speech = await aiClient(platform).speak(text, voice);
	return new Response(speech.body, {
		headers: { 'content-type': speech.contentType, 'cache-control': 'private, max-age=3600' }
	});
};
