import { expect, test, type Page } from '@playwright/test';
import { bearer, DUMMY_RESPONSE } from './session';

const UNVERIFIED = 'Verification failed. Reload and try again.';

function watch(page: Page, match: (url: string) => boolean) {
	const seen: string[] = [];
	page.on('request', (r) => {
		if (match(r.url())) seen.push(r.url());
	});
	return seen;
}

test.describe('token gate', () => {
	test('AI routes answer 401 without a token', async ({ request }) => {
		const speak = await request.post('/api/speak', { data: { text: 'hi', voice: 'orion' } });
		expect(speak.status()).toBe(401);
		expect((await speak.json()).message).toBe(UNVERIFIED);
		const rewrite = await request.post('/api/rewrite', {
			data: {
				lines: [{ id: 'l0', speaker: 0, original: 'Hello there.', syllables: 3, lips: [] }]
			}
		});
		expect(rewrite.status()).toBe(401);
		const transcribe = await request.post('/api/transcribe?duration=1', {
			headers: { 'content-type': 'audio/wav' },
			data: Buffer.alloc(64)
		});
		expect(transcribe.status()).toBe(401);
	});

	test('a tampered or malformed token is refused', async ({ request }) => {
		const { authorization } = await bearer(request);
		const [scheme, token] = authorization.split(' ');
		const [exp, sig] = token.split('.');
		for (const bad of [`${Number(exp) + 1}.${sig}`, `${exp}.${sig}x`, 'nope', '']) {
			const res = await request.post('/api/speak', {
				headers: { authorization: `${scheme} ${bad}` },
				data: { text: 'hi', voice: 'orion' }
			});
			expect(res.status()).toBe(401);
		}
	});

	test('the token route needs a challenge response', async ({ request }) => {
		const res = await request.post('/api/token', { data: {} });
		expect(res.status()).toBe(403);
		expect((await res.json()).message).toBe('Browser check failed. Reload and try again.');
		const ok = await request.post('/api/token', { data: { response: DUMMY_RESPONSE } });
		expect(ok.status()).toBe(200);
		const body = (await ok.json()) as { token: string; expires: number };
		expect(body.token).toMatch(/^\d+\.[\w-]+$/);
		expect(body.expires).toBeGreaterThan(Date.now());
	});
});

test.describe('in the browser', () => {
	test('the challenge loads only after a drop and the flow completes under the guards', async ({
		page
	}) => {
		const turnstile = watch(page, (u) => u.includes('challenges.cloudflare.com'));
		const tokens = watch(page, (u) => u.endsWith('/api/token'));
		await page.goto('/');
		await expect(page.getByText('Drop a video.')).toBeVisible();
		expect(turnstile).toHaveLength(0);
		await page.getByRole('button', { name: 'or try a sample' }).click();
		await expect(page.locator('.lines li .new').first()).toBeVisible({ timeout: 30_000 });
		expect(turnstile.length).toBeGreaterThan(0);
		await page.getByRole('button', { name: 'Voice it' }).click();
		await expect(page.getByRole('button', { name: 'Voiced' })).toBeVisible({ timeout: 60_000 });
		expect(tokens).toHaveLength(1);
		await expect(page.getByRole('alert')).toHaveCount(0);
		await page.screenshot({ path: 'test-results/guards-flow.png', fullPage: true });
	});

	test('a 401 refreshes the token once and retries', async ({ page }) => {
		let hits = 0;
		await page.route('**/api/rewrite', async (route) => {
			if (hits++ === 0) {
				await route.fulfill({ status: 401, json: { message: UNVERIFIED } });
				return;
			}
			await route.continue();
		});
		const tokens = watch(page, (u) => u.endsWith('/api/token'));
		await page.goto('/');
		await page.getByRole('button', { name: 'or try a sample' }).click();
		await expect(page.locator('.lines li .new').first()).toBeVisible({ timeout: 30_000 });
		expect(hits).toBe(3);
		expect(tokens).toHaveLength(2);
	});

	test('a server refusal shows in the error slot', async ({ page }) => {
		await page.route('**/api/transcribe**', (route) =>
			route.fulfill({ status: 429, json: { message: 'Daily limit reached. Try again tomorrow.' } })
		);
		await page.goto('/');
		await page.getByRole('button', { name: 'or try a sample' }).click();
		await expect(page.getByRole('alert')).toHaveText('Daily limit reached. Try again tomorrow.', {
			timeout: 30_000
		});
		await page.screenshot({ path: 'test-results/guards-limit.png', fullPage: true });
	});
});
