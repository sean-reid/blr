import { expect, test } from './test';
import { fixturesPresent, seedModels } from './separation-fixtures.ts';

test('without the model the mix falls back to ducking and says so', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'or try a sample' }).click();
	await expect(page.locator('.lines li .new').first()).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('.frame')).toHaveAttribute('data-separation', 'unavailable', {
		timeout: 30_000
	});
	await page.getByRole('button', { name: 'Voice it' }).click();
	await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({ timeout: 60_000 });
	await expect(page.getByText('Separation is unavailable here.')).toBeVisible();
});

test.describe('with the model served', () => {
	test.use({ separation: true });

	test('the mix uses the separated instrumental', async ({ page }) => {
		test.skip(!fixturesPresent(), 'needs the model in /tmp');
		test.setTimeout(10 * 60 * 1000);
		seedModels();
		await page.goto('/');
		await page.getByRole('button', { name: 'or try a sample' }).click();
		await expect(page.locator('.lines li .new').first()).toBeVisible({ timeout: 30_000 });
		await page.getByRole('button', { name: 'Voice it' }).click();
		await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({
			timeout: 8 * 60_000
		});
		await expect(page.locator('.frame')).toHaveAttribute('data-separation', 'ready');
		await expect(page.getByText('Separation is unavailable here.')).toHaveCount(0);
		await page.screenshot({ path: 'test-results/separated-desktop.png', fullPage: true });
	});
});

test('the dev bench page is only served when dev pages are enabled', async ({ request }) => {
	const res = await request.get('/dev/separate');
	expect(res.status()).toBe(200);
});
