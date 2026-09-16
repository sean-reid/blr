import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const viewports = [
	{ name: 'mobile', width: 375, height: 740 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'desktop', width: 1024, height: 768 }
];

for (const vp of viewports) {
	test(`drop state renders at ${vp.name}`, async ({ page }) => {
		await page.setViewportSize({ width: vp.width, height: vp.height });
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Choose a video' })).toBeVisible();
		await expect(page.getByText('Drop a video.')).toBeVisible();
		await page.screenshot({ path: `test-results/drop-${vp.name}.png`, fullPage: true });
	});
}

test('theme toggle persists', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Dark' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.screenshot({ path: 'test-results/drop-dark.png', fullPage: true });
});

test('about panel opens and closes', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'About' }).click();
	await expect(page.locator('#about')).toBeVisible();
	await page.getByRole('button', { name: 'Close' }).click();
	await expect(page.locator('#about')).toHaveCount(0);
});

test('rejects a non-video file', async ({ page }) => {
	await page.goto('/');
	await page.locator('input[type=file]').setInputFiles({
		name: 'notes.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('hello')
	});
	await expect(page.getByRole('alert')).toHaveText('That is not a video file.');
});

test('refuses a file over 500 MB before upload', async ({ page }) => {
	const uploads: string[] = [];
	page.on('request', (r) => r.url().includes('/api/') && uploads.push(r.url()));
	await page.goto('/');
	await page.evaluate(() => {
		const file = new File([new Uint8Array(16)], 'huge.mp4', { type: 'video/mp4' });
		Object.defineProperty(file, 'size', { value: 501 * 1024 * 1024 });
		const drop = new Event('drop', { bubbles: true, cancelable: true });
		Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } });
		document.querySelector('.zone')!.dispatchEvent(drop);
	});
	await expect(page.getByRole('alert')).toHaveText('That file is over 500 MB. Use a smaller one.');
	await expect(page.locator('video')).toHaveCount(0);
	expect(uploads).toHaveLength(0);
});

test('refuses a video over 3 minutes before upload', async ({ page }) => {
	const uploads: string[] = [];
	page.on('request', (r) => r.url().includes('/api/') && uploads.push(r.url()));
	await page.addInitScript(() => {
		Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get: () => 181 });
	});
	await page.goto('/');
	await page.locator('input[type=file]').setInputFiles({
		name: 'long.mp4',
		mimeType: 'video/mp4',
		buffer: readFileSync('static/sample.mp4')
	});
	await expect(page.getByRole('alert')).toHaveText(
		'That video runs over 3 minutes. Trim it first.'
	);
	await expect(page.locator('video')).toHaveCount(0);
	expect(uploads).toHaveLength(0);
	await page.screenshot({ path: 'test-results/drop-too-long.png', fullPage: true });
});
