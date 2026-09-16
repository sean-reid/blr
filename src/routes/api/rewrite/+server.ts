import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiClient } from '$lib/server/ai';
import { NEURONS } from '$lib/server/budget';
import { guard } from '$lib/server/guard';
import { responseSchema, SYSTEM, userMessage, validate } from '$lib/rewrite/prompt';
import type { RewriteRequest } from '$lib/rewrite/types';

const MAX_LINES = 10;
const MAX_OPTIONS = 8;
const MAX_TEXT = 400;

function check(body: unknown): RewriteRequest {
	const b = body as Partial<RewriteRequest>;
	const revisions = Array.isArray(b.revisions) ? b.revisions : [];
	if (!Array.isArray(b.lines) || (!b.lines.length && !revisions.length)) error(400, 'No lines.');
	if (b.lines.length + revisions.length > MAX_LINES)
		error(400, `At most ${MAX_LINES} lines per request.`);
	for (const r of revisions) {
		if (typeof r.id !== 'string' || typeof r.text !== 'string' || r.text.length > MAX_TEXT)
			error(400, 'Bad revision.');
		if (!Number.isInteger(r.add) || r.add < 1 || r.add > 40) error(400, 'Bad revision.');
	}
	for (const l of b.lines) {
		if (typeof l.id !== 'string' || typeof l.original !== 'string') error(400, 'Bad line.');
		if (l.original.length > MAX_TEXT) error(400, 'Line too long.');
		if (
			!Array.isArray(l.pattern) ||
			!l.pattern.length ||
			l.pattern.length > 40 ||
			!l.pattern.every((n) => Number.isInteger(n) && n >= 1 && n <= 60)
		)
			error(400, 'Bad pattern.');
		if (!Array.isArray(l.lips) || l.lips.length > 40) error(400, 'Bad cues.');
	}
	const options = Math.min(MAX_OPTIONS, Math.max(3, Number(b.options) || 6));
	return {
		lines: b.lines.map((l) => ({
			id: l.id,
			speaker: Number(l.speaker) || 0,
			original: l.original,
			pattern: l.pattern,
			lips: l.lips.map(Number).filter((n) => Number.isInteger(n) && n > 0)
		})),
		revisions: revisions.map((r) => ({
			id: r.id,
			speaker: Number(r.speaker) || 0,
			text: r.text,
			add: r.add
		})),
		speakers: Math.min(8, Math.max(1, Number(b.speakers) || 1)),
		tone: b.tone === 'clean' ? 'clean' : 'pg13',
		options,
		context: (b.context ?? []).slice(0, 4)
	};
}

export const POST: RequestHandler = async (event) => {
	const { request, platform } = event;
	const req = check(await request.json().catch(() => error(400, 'Bad JSON.')));
	await guard(event, NEURONS.rewrite);
	const syllables =
		req.lines.reduce((n, l) => n + l.pattern.reduce((a, b) => a + b, 0), 0) +
		(req.revisions ?? []).reduce((n, r) => n + r.add + 12, 0);
	const count = req.lines.length + (req.revisions?.length ?? 0);
	const raw = await aiClient(platform).chatJson({
		system: SYSTEM,
		user: userMessage(req),
		schema: responseSchema(req),
		maxTokens: 80 + count * 12 + syllables * req.options * 3,
		temperature: 0.9
	});
	return json(validate(req, raw));
};
