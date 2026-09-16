import { expect, test } from '@playwright/test';

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
