const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** The response Turnstile's test site keys hand every visitor. */
export const DUMMY_RESPONSE = 'XXXX.DUMMY.TOKEN.XXXX';

export interface TurnstileOptions {
	ip?: string | null;
	mock?: boolean;
	fetcher?: typeof fetch;
}

export async function verifyTurnstile(
	response: string,
	secret: string,
	{ ip, mock = false, fetcher = fetch }: TurnstileOptions = {}
): Promise<boolean> {
	if (!response) return false;
	if (mock && response === DUMMY_RESPONSE) return true;
	const form = new FormData();
	form.set('secret', secret);
	form.set('response', response);
	if (ip) form.set('remoteip', ip);
	const res = await fetcher(SITEVERIFY, { method: 'POST', body: form });
	if (!res.ok) return false;
	const body = (await res.json().catch(() => null)) as { success?: boolean } | null;
	return body?.success === true;
}
