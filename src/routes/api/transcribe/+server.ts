import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiClient } from '$lib/server/ai';
import { transcribeNeurons } from '$lib/server/budget';
import { guard } from '$lib/server/guard';
import { normalizeNova } from '$lib/transcript/normalize';

const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/flac', 'audio/ogg', 'audio/webm']);
/** Bytes per second of 16 kHz mono 16-bit PCM, so the body size floors a duration the client understates. */
const BYTES_PER_SECOND = 32_000;

export const POST: RequestHandler = async (event) => {
	const { request, platform, url } = event;
	const type = request.headers.get('content-type')?.split(';')[0].trim() ?? '';
	if (!TYPES.has(type)) error(415, 'Send audio as wav, flac, ogg or webm.');
	const length = Number(request.headers.get('content-length') ?? 0);
	if (length > MAX_BYTES) error(413, 'Audio is too large.');
	if (!request.body) error(400, 'Empty body.');
	const duration = Number(url.searchParams.get('duration') ?? 0);
	await guard(event, transcribeNeurons(Math.max(duration, length / BYTES_PER_SECOND)));

	const res = await aiClient(platform).transcribe(request.body, type);
	return json(normalizeNova(res, duration));
};
