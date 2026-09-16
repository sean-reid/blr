import { error, type RequestEvent } from '@sveltejs/kit';
import { charge, DEFAULT_DAILY_NEURONS } from './budget';
import { verify } from './token';

export const MESSAGES = {
	unverified: 'Verification failed. Reload and try again.',
	rateLimited: 'Slow down. Try again in a minute.',
	budget: 'Daily limit reached. Try again tomorrow.'
} as const;

export function clientIp(request: Request): string | null {
	return request.headers.get('cf-connecting-ip');
}

/** A missing binding means no limit, which is how dev and preview run. */
export async function rateLimit(request: Request, rate: RateLimit | undefined) {
	if (!rate) return;
	const { success } = await rate.limit({ key: clientIp(request) ?? 'unknown' });
	if (!success) error(429, MESSAGES.rateLimited);
}

export async function requireToken(request: Request, secret: string | undefined) {
	if (!secret) error(500, 'Server is missing TOKEN_SECRET.');
	const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
	if (!(await verify(token, secret))) error(401, MESSAGES.unverified);
}

export async function requireBudget(env: Partial<Env> | undefined, neurons: number) {
	if (!env?.BUDGET) error(500, 'Server is missing BUDGET.');
	const limit = Number(env.DAILY_NEURONS) || DEFAULT_DAILY_NEURONS;
	if (!(await charge(env.BUDGET, neurons, limit))) error(429, MESSAGES.budget);
}

export async function guard({ request, platform }: RequestEvent, neurons: number) {
	const env = platform?.env;
	await rateLimit(request, env?.RATE);
	await requireToken(request, env?.TOKEN_SECRET);
	await requireBudget(env, neurons);
}
