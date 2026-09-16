import { describe, expect, it } from 'vitest';
import { DUMMY_RESPONSE, verifyTurnstile } from './turnstile';

function fakeSiteverify(success: boolean) {
	const calls: FormData[] = [];
	const fetcher = (async (_url: string, init?: RequestInit) => {
		calls.push(init?.body as FormData);
		return Response.json({ success });
	}) as typeof fetch;
	return { fetcher, calls };
}

describe('verifyTurnstile', () => {
	it('posts the secret, response and ip to siteverify', async () => {
		const { fetcher, calls } = fakeSiteverify(true);
		expect(await verifyTurnstile('abc', 's3', { ip: '1.2.3.4', fetcher })).toBe(true);
		expect(calls[0].get('secret')).toBe('s3');
		expect(calls[0].get('response')).toBe('abc');
		expect(calls[0].get('remoteip')).toBe('1.2.3.4');
	});

	it('fails on a refused or empty response', async () => {
		const { fetcher, calls } = fakeSiteverify(false);
		expect(await verifyTurnstile('abc', 's3', { fetcher })).toBe(false);
		expect(await verifyTurnstile('', 's3', { fetcher })).toBe(false);
		expect(calls.length).toBe(1);
	});

	it('accepts the test dummy response in mock mode without calling out', async () => {
		const { fetcher, calls } = fakeSiteverify(false);
		expect(await verifyTurnstile(DUMMY_RESPONSE, 's3', { mock: true, fetcher })).toBe(true);
		expect(await verifyTurnstile(DUMMY_RESPONSE, 's3', { fetcher })).toBe(false);
		expect(await verifyTurnstile('real', 's3', { mock: true, fetcher })).toBe(false);
		expect(calls.length).toBe(2);
	});
});
