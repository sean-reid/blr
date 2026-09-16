import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clientIp, rateLimit } from '$lib/server/guard';
import { mint } from '$lib/server/token';
import { verifyTurnstile } from '$lib/server/turnstile';

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	await rateLimit(request, env?.RATE);
	if (!env?.TURNSTILE_SECRET) error(500, 'Server is missing TURNSTILE_SECRET.');
	if (!env.TOKEN_SECRET) error(500, 'Server is missing TOKEN_SECRET.');
	const body = (await request.json().catch(() => null)) as { response?: unknown } | null;
	const response = typeof body?.response === 'string' ? body.response : '';
	const ok = await verifyTurnstile(response, env.TURNSTILE_SECRET, {
		ip: clientIp(request),
		mock: String(env.AI_MODE) === 'mock'
	});
	if (!ok) error(403, 'Browser check failed. Reload and try again.');
	return json(await mint(env.TOKEN_SECRET));
};
