import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('a dropped video is transcribed into speaker lines', async ({ page }) => {
	await page.goto('/');
	await page.locator('input[type=file]').setInputFiles({
		name: 'sample.mp4',
		mimeType: 'video/mp4',
		buffer: readFileSync('static/sample.mp4')
	});
	await expect(page.locator('video')).toBeVisible();
	await expect(page.getByRole('status')).toBeVisible();
	const lines = page.locator('.lines li');
	await expect(lines.first()).toBeVisible({ timeout: 30_000 });
	await expect(lines).toHaveCount(9);
	await expect(page.getByText('And by the way, how are things going in school?')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Speaker A' }).first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Speaker B' }).first()).toBeVisible();
	await page.screenshot({ path: 'test-results/transcript-desktop.png', fullPage: true });
});

test('the sample link runs the same flow', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 740 });
	await page.goto('/');
	await page.getByRole('button', { name: 'or try a sample' }).click();
	await expect(page.locator('.lines li').first()).toBeVisible({ timeout: 30_000 });
	await page.screenshot({ path: 'test-results/transcript-mobile.png', fullPage: true });
});

test('clicking a line seeks the video', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'or try a sample' }).click();
	const line = page.getByText('And by the way, how are things going in school?');
	await expect(line).toBeVisible({ timeout: 30_000 });
	await line.click();
	const t = await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime);
	expect(t).toBeGreaterThan(6);
});

test('the transcribe route rejects non-audio', async ({ request }) => {
	const res = await request.post('/api/transcribe', {
		headers: { 'content-type': 'application/octet-stream' },
		data: 'hello'
	});
	expect(res.status()).toBe(415);
});
