import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('download writes an mp4 with the original video and the new audio', async ({ page }) => {
	test.setTimeout(120_000);
	await page.goto('/');
	await page.getByRole('button', { name: 'or try a sample' }).click();
	await expect(page.locator('.lines li .new').first()).toBeVisible({ timeout: 30_000 });
	await page.getByRole('button', { name: 'Voice it' }).click();
	await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({ timeout: 60_000 });
	const [download] = await Promise.all([
		page.waitForEvent('download', { timeout: 90_000 }),
		page.getByRole('button', { name: 'Download' }).click()
	]);
	expect(download.suggestedFilename()).toBe('sample.blr.mp4');
	const dir = mkdtempSync(join(tmpdir(), 'blr-export-'));
	const path = join(dir, 'out.mp4');
	await download.saveAs(path);
	const probe = JSON.parse(
		execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], {
			encoding: 'utf8'
		})
	) as {
		streams: { codec_type: string; codec_name: string; duration?: string }[];
		format: { duration: string };
	};
	const video = probe.streams.find((s) => s.codec_type === 'video');
	const audio = probe.streams.find((s) => s.codec_type === 'audio');
	expect(video?.codec_name).toBe('h264');
	expect(['aac', 'opus']).toContain(audio?.codec_name);
	expect(Number(probe.format.duration)).toBeGreaterThan(24);
	expect(Number(probe.format.duration)).toBeLessThan(26);
	writeFileSync(join(dir, 'ok'), '');
});
