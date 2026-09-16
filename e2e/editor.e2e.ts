import { expect, test, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const rows = (page: Page) => page.locator('.lines li');

async function voiced(page: Page) {
	await page.getByRole('button', { name: 'Voice it' }).click();
	await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({ timeout: 60_000 });
}

async function seekToRow(page: Page, i: number) {
	const [m, s] = (await rows(page).nth(i).locator('.time').innerText()).split(':');
	const t = Number(m) * 60 + Number(s) + 0.05;
	await page.evaluate((t) => {
		const v = document.querySelector('video')!;
		v.pause();
		v.currentTime = t;
	}, t);
	await expect(rows(page).nth(i)).toHaveClass(/current/);
}

async function rename(page: Page, letter: string, name: string) {
	await page
		.getByRole('button', { name: `Rename speaker ${letter}` })
		.first()
		.click();
	const input = page.getByRole('textbox', { name: `Name for speaker ${letter}` });
	await input.fill(name);
	await input.press('Enter');
}

async function text(download: Download) {
	return readFileSync((await download.path())!, 'utf8');
}

test.describe('editor', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'or try a sample' }).click();
		await expect(page.locator('.lines li .new').first()).toBeVisible({ timeout: 30_000 });
	});

	test('captions show the current new line over the video', async ({ page }) => {
		await voiced(page);
		await expect(page.locator('.caption')).toHaveCount(0);
		await page.getByLabel('Captions').check();
		await seekToRow(page, 2);
		const line = (await rows(page).nth(2).locator('.new').innerText()).trim();
		await expect(page.locator('.caption .text')).toHaveText(line);
		await expect(page.locator('.caption .who')).toHaveText(/^[AB]$/);
		await page.evaluate(() => scrollTo(0, 0));
		await page.screenshot({ path: 'test-results/captions-desktop.png' });
		await page.setViewportSize({ width: 375, height: 740 });
		await page.screenshot({ path: 'test-results/captions-mobile.png' });
		await page.setViewportSize({ width: 768, height: 900 });
		await page.screenshot({ path: 'test-results/captions-tablet.png', fullPage: true });
		await page.getByLabel('New audio').uncheck();
		await expect(page.locator('.caption')).toHaveCount(0);
	});

	test('VTT and SRT sidecars carry the new lines and speaker names', async ({ page }) => {
		await rename(page, 'A', 'Nat');
		await voiced(page);
		const first = (await rows(page).nth(0).locator('.new').innerText()).trim();
		const [vtt] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('button', { name: 'VTT', exact: true }).click()
		]);
		expect(vtt.suggestedFilename()).toBe('sample.blr.vtt');
		const vttBody = await text(vtt);
		expect(vttBody.startsWith('WEBVTT\n\n1\n')).toBe(true);
		expect(vttBody).toContain(`<v Nat>${first}`);
		expect(vttBody).toContain('<v Speaker B>');
		const [srt] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('button', { name: 'SRT', exact: true }).click()
		]);
		expect(srt.suggestedFilename()).toBe('sample.blr.srt');
		const srtBody = await text(srt);
		expect(srtBody.startsWith('1\n00:00:')).toBe(true);
		expect(srtBody).toContain(`\nNat: ${first}`);
		expect(srtBody).not.toContain('<v');
		await page.setViewportSize({ width: 375, height: 740 });
		await page.screenshot({ path: 'test-results/sidecars-mobile.png', fullPage: true });
	});

	test('a muted line keeps the original audio and is skipped by speech and captions', async ({
		page
	}) => {
		let speakCalls = 0;
		const spokenTexts: string[] = [];
		page.on('request', (r) => {
			if (r.url().endsWith('/api/speak')) {
				speakCalls++;
				spokenTexts.push(String(r.postDataJSON()?.text ?? ''));
			}
		});
		const row = rows(page).nth(1);
		const mutedText = (await row.locator('.new').innerText()).trim();
		await row.hover();
		await row.getByRole('button', { name: 'Mute line 2' }).click();
		await expect(row).toHaveClass(/muted/);
		await expect(row.getByRole('button', { name: 'Mute line 2' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(row.locator('.new')).toHaveCSS('text-decoration-line', 'line-through');
		await voiced(page);
		expect(speakCalls).toBeGreaterThanOrEqual(8);
		expect(spokenTexts).not.toContain(mutedText);
		await page.getByLabel('Captions').check();
		await seekToRow(page, 1);
		await expect(page.locator('.caption')).toHaveCount(0);
		await seekToRow(page, 0);
		await expect(page.locator('.caption')).toHaveCount(1);
		await page.screenshot({ path: 'test-results/mute-desktop.png', fullPage: true });
		await rows(page).nth(3).hover();
		await rows(page).nth(3).getByRole('button', { name: 'Mute line 4' }).click();
		await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Voice it again' })).toBeVisible();
	});

	test('renaming a speaker reaches the rows and the picker, and empty reverts', async ({
		page
	}) => {
		await rename(page, 'A', 'Nat');
		await expect(page.locator('.lines li .name', { hasText: 'Nat' }).first()).toBeVisible();
		await expect(page.locator('.lines li .name', { hasText: /^A$/ })).toHaveCount(0);
		await expect(page.getByRole('combobox', { name: 'Voice for Nat' })).toBeVisible();
		await expect(page.getByRole('combobox', { name: 'Voice for Speaker B' })).toBeVisible();
		await page.setViewportSize({ width: 375, height: 740 });
		await page.screenshot({ path: 'test-results/rename-mobile.png', fullPage: true });
		await rename(page, 'A', '   ');
		await expect(page.getByRole('combobox', { name: 'Voice for Speaker A' })).toBeVisible();
		await expect(page.locator('.lines li .name', { hasText: 'Nat' })).toHaveCount(0);
	});

	test('the clean toggle reruns the rewrite with tone clean and stales the mix', async ({
		page
	}) => {
		await voiced(page);
		const [req] = await Promise.all([
			page.waitForRequest((r) => r.url().endsWith('/api/rewrite')),
			page.getByLabel('Clean').check()
		]);
		expect(req.postDataJSON().tone).toBe('clean');
		await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Voice it again' })).toBeEnabled({
			timeout: 30_000
		});
		const [back] = await Promise.all([
			page.waitForRequest((r) => r.url().endsWith('/api/rewrite')),
			page.getByLabel('Clean').uncheck()
		]);
		expect(back.postDataJSON().tone).toBe('pg13');
	});

	test('space plays, r rerolls and m mutes the current line', async ({ page }) => {
		const video = page.locator('video');
		const paused = () => video.evaluate((v: HTMLVideoElement) => v.paused);
		expect(await paused()).toBe(true);
		await page.keyboard.press('Space');
		await expect.poll(paused).toBe(false);
		await page.keyboard.press('Space');
		await expect.poll(paused).toBe(true);
		await seekToRow(page, 3);
		const row = rows(page).nth(3);
		const before = await row.locator('.new').innerText();
		await page.keyboard.press('r');
		await expect(row.locator('.new')).not.toHaveText(before);
		await page.keyboard.press('m');
		await expect(row).toHaveClass(/muted/);
		await row.getByRole('button', { name: 'Edit new line 4' }).click();
		await page.keyboard.press('m');
		await page.keyboard.press('Escape');
		await expect(row).toHaveClass(/muted/);
	});
});
