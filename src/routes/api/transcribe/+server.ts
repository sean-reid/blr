import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiClient } from '$lib/server/ai';
import { normalizeNova } from '$lib/transcript/normalize';

const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/flac', 'audio/ogg', 'audio/webm']);

export const POST: RequestHandler = async ({ request, platform, url }) => {
	const type = request.headers.get('content-type')?.split(';')[0].trim() ?? '';
	if (!TYPES.has(type)) error(415, 'Send audio as wav, flac, ogg or webm.');
	const length = Number(request.headers.get('content-length') ?? 0);
	if (length > MAX_BYTES) error(413, 'Audio is too large.');
	if (!request.body) error(400, 'Empty body.');
	const duration = Number(url.searchParams.get('duration') ?? 0);

	const res = await aiClient(platform).transcribe(request.body, type);
	return json(normalizeNova(res, duration));
};
