import { expect, test } from './test';
import { bearer } from './session';

test.describe('voicing', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'or try a sample' }).click();
		await expect(page.locator('.lines li .new').first()).toBeVisible({ timeout: 30_000 });
	});

	test('voice it produces new audio and the player switches to it', async ({ page }) => {
		const a = await page.getByRole('combobox', { name: 'Voice for speaker A' }).inputValue();
		const b = await page.getByRole('combobox', { name: 'Voice for speaker B' }).inputValue();
		expect(a).not.toBe(b);
		expect(a.length).toBeGreaterThan(0);
		let speakCalls = 0;
		page.on('request', (r) => {
			if (r.url().endsWith('/api/speak')) speakCalls++;
		});
		await page.getByRole('button', { name: 'Voice it' }).click();
		await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({ timeout: 60_000 });
		expect(speakCalls).toBe(9);
		await expect(page.locator('video')).toHaveAttribute('data-audio', 'new');
		await page.getByLabel('New audio').uncheck();
		await expect(page.locator('video')).toHaveAttribute('data-audio', 'original');
		await page.screenshot({ path: 'test-results/voice-desktop.png', fullPage: true });
	});

	test('changing a voice or a line marks the mix stale', async ({ page }) => {
		await page.getByRole('button', { name: 'Voice it' }).click();
		await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({ timeout: 60_000 });
		await page.getByRole('combobox', { name: 'Voice for speaker B' }).selectOption('zeus');
		await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Voice it again' })).toBeVisible();
		await page.setViewportSize({ width: 375, height: 740 });
		await page.screenshot({ path: 'test-results/voice-mobile.png', fullPage: true });
	});
});

test('the speak route validates its input and answers audio', async ({ request }) => {
	const bad = await request.post('/api/speak', { data: { text: 'hi', voice: 'nobody' } });
	expect(bad.status()).toBe(400);
	const headers = await bearer(request);
	const ok = await request.post('/api/speak', {
		headers,
		data: { text: 'My cat is mad', voice: 'orion' }
	});
	expect(ok.status()).toBe(200);
	expect(ok.headers()['content-type']).toBe('audio/mpeg');
	const fallback = await request.post('/api/speak', {
		headers,
		data: { text: 'Never recorded', voice: 'orion' }
	});
	expect(fallback.headers()['content-type']).toBe('audio/wav');
	expect((await fallback.body()).length).toBeGreaterThan(1000);
});
