import { expect, test } from '@playwright/test';

test.describe('editor', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'or try a sample' }).click();
		await expect(page.locator('.lines li .new').first()).toBeVisible({ timeout: 30_000 });
	});

	test('every line gets a new reading that differs from the original', async ({ page }) => {
		const rows = page.locator('.lines li');
		await expect(rows).toHaveCount(9);
		for (let i = 0; i < 9; i++) {
			const row = rows.nth(i);
			const original = (await row.locator('.original span').last().innerText()).trim();
			const fresh = (await row.locator('.new').innerText()).trim();
			expect(fresh.length).toBeGreaterThan(0);
			expect(fresh.toLowerCase()).not.toBe(original.toLowerCase());
		}
		await page.screenshot({ path: 'test-results/rewrite-desktop.png', fullPage: true });
	});

	test('reroll moves to the next option without a network call', async ({ page }) => {
		let calls = 0;
		page.on('request', (r) => {
			if (r.url().endsWith('/api/rewrite')) calls++;
		});
		const row = page.locator('.lines li').nth(3);
		const before = await row.locator('.new').innerText();
		await row.getByRole('button', { name: 'Reroll line 4' }).click();
		await expect(row.locator('.new')).not.toHaveText(before);
		expect(calls).toBe(0);
	});

	test('a line can be edited by hand and shows mouth match shading', async ({ page }) => {
		const row = page.locator('.lines li').nth(4);
		await row.getByRole('button', { name: 'Edit new line 5' }).click();
		const input = row.getByRole('textbox', { name: 'New line 5' });
		await input.fill('No, no way, Nat.');
		await input.press('Enter');
		await expect(row.locator('.new')).toHaveText('No, no way, Nat.');
		await expect(row.locator('.new .w')).toHaveCount(4);
		await row.getByRole('button', { name: 'Edit new line 5' }).click();
		await row.getByRole('textbox', { name: 'New line 5' }).fill('Photosynthesis is complicated.');
		await row.getByRole('textbox', { name: 'New line 5' }).press('Enter');
		await expect(row.locator('.new .w.far').first()).toBeVisible();
		await page.setViewportSize({ width: 375, height: 740 });
		await page.screenshot({ path: 'test-results/rewrite-mobile.png', fullPage: true });
	});
});

test('the rewrite route rejects malformed requests', async ({ request }) => {
	const res = await request.post('/api/rewrite', {
		headers: { 'content-type': 'application/json' },
		data: { lines: [] }
	});
	expect(res.status()).toBe(400);
});
