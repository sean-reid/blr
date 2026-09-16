import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiClient } from '$lib/server/ai';
import { responseSchema, SYSTEM, userMessage, validate } from '$lib/rewrite/prompt';
import type { RewriteRequest } from '$lib/rewrite/types';

const MAX_LINES = 10;
const MAX_OPTIONS = 8;
const MAX_TEXT = 400;

function check(body: unknown): RewriteRequest {
	const b = body as Partial<RewriteRequest>;
	if (!Array.isArray(b.lines) || !b.lines.length) error(400, 'No lines.');
	if (b.lines.length > MAX_LINES) error(400, `At most ${MAX_LINES} lines per request.`);
	for (const l of b.lines) {
		if (typeof l.id !== 'string' || typeof l.original !== 'string') error(400, 'Bad line.');
		if (l.original.length > MAX_TEXT) error(400, 'Line too long.');
		if (!Number.isInteger(l.syllables) || l.syllables < 1 || l.syllables > 60)
			error(400, 'Bad syllables.');
		if (!Array.isArray(l.lips) || l.lips.length > 40) error(400, 'Bad cues.');
	}
	const options = Math.min(MAX_OPTIONS, Math.max(3, Number(b.options) || 6));
	return {
		lines: b.lines.map((l) => ({
			id: l.id,
			speaker: Number(l.speaker) || 0,
			original: l.original,
			syllables: l.syllables,
			lips: l.lips.map(Number).filter((n) => Number.isInteger(n) && n > 0)
		})),
		speakers: Math.min(8, Math.max(1, Number(b.speakers) || 1)),
		tone: b.tone === 'clean' ? 'clean' : 'pg13',
		options,
		context: (b.context ?? []).slice(0, 4)
	};
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const req = check(await request.json().catch(() => error(400, 'Bad JSON.')));
	const syllables = req.lines.reduce((n, l) => n + l.syllables, 0);
	const raw = await aiClient(platform).chatJson({
		system: SYSTEM,
		user: userMessage(req),
		schema: responseSchema(req),
		maxTokens: 80 + req.lines.length * 12 + syllables * req.options * 3,
		temperature: 0.9
	});
	return json(validate(req, raw));
};
