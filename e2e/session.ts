import type { APIRequestContext } from '@playwright/test';

/** Turnstile's test site key answers every visitor with this response; mock mode accepts it. */
export const DUMMY_RESPONSE = 'XXXX.DUMMY.TOKEN.XXXX';

export async function bearer(request: APIRequestContext): Promise<{ authorization: string }> {
	const res = await request.post('/api/token', { data: { response: DUMMY_RESPONSE } });
	if (!res.ok()) throw new Error(`token: ${res.status()} ${await res.text()}`);
	const { token } = (await res.json()) as { token: string };
	return { authorization: `Bearer ${token}` };
}
