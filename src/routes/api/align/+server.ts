import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiClient } from '$lib/server/ai';
import { transcribeNeurons } from '$lib/server/budget';
import { guard } from '$lib/server/guard';
import { alignToText } from '$lib/voice/align-text';

const MAX_BYTES = 6 * 1024 * 1024;
const TYPES = new Set(['audio/wav', 'audio/x-wav']);

export const POST: RequestHandler = async (event) => {
	const { request, platform, url } = event;
	const type = request.headers.get('content-type')?.split(';')[0].trim() ?? '';
	if (!TYPES.has(type)) error(415, 'Send audio as wav.');
	const length = Number(request.headers.get('content-length') ?? 0);
	if (length > MAX_BYTES) error(413, 'Audio is too large.');
	if (!request.body) error(400, 'Empty body.');
	const text = (url.searchParams.get('text') ?? '').replace(/\s+/g, ' ').trim();
	const duration = Number(url.searchParams.get('duration') ?? 0);
	if (!text || text.length > 300) error(400, 'Bad text.');
	if (!(duration > 0 && duration < 60)) error(400, 'Bad duration.');
	await guard(event, transcribeNeurons(duration));

	const res = await aiClient(platform).transcribe(request.body, type);
	const heard = (res.results.channels[0]?.alternatives[0]?.words ?? []).map((w) => ({
		word: w.word,
		start: w.start,
		end: w.end
	}));
	return json({ words: alignToText(text, heard, duration) });
};
