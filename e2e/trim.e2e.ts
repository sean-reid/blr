import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from './test';

function haveFfmpeg() {
	try {
		execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

function longClip(seconds: number): string {
	const dir = mkdtempSync(join(tmpdir(), 'blr-long-'));
	const path = join(dir, 'long.mp4');
	execFileSync('ffmpeg', [
		'-v',
		'error',
		'-y',
		'-f',
		'lavfi',
		'-i',
		`testsrc=duration=${seconds}:size=320x240:rate=10`,
		'-f',
		'lavfi',
		'-i',
		`sine=frequency=330:duration=${seconds}`,
		'-c:v',
		'libx264',
		'-preset',
		'ultrafast',
		'-pix_fmt',
		'yuv420p',
		'-c:a',
		'aac',
		'-shortest',
		path
	]);
	return path;
}

test('a video over three minutes offers a trim window and exports only that part', async ({
	page
}) => {
	test.skip(!haveFfmpeg(), 'needs ffmpeg');
	test.setTimeout(180_000);
	await page.goto('/');
	await page.locator('input[type=file]').setInputFiles(longClip(200));
	const start = page.getByRole('slider', { name: 'Start' });
	const end = page.getByRole('slider', { name: 'End' });
	await expect(start).toBeVisible();
	await expect(end).toHaveAttribute('aria-valuenow', '180');
	await expect(page.getByText('This video runs 3:20. Pick up to 3:00 of it.')).toBeVisible();
	await end.focus();
	for (let i = 0; i < 6; i++) await end.press('Shift+ArrowLeft');
	await expect(end).toHaveAttribute('aria-valuenow', '120');
	await start.focus();
	await start.press('Shift+ArrowRight');
	await expect(start).toHaveAttribute('aria-valuenow', '10');
	await expect(page.getByText('0:10 to 2:00, 1:50')).toBeVisible();
	await page.screenshot({ path: 'test-results/trim-desktop.png', fullPage: true });
	await page.getByRole('button', { name: 'Use this part' }).click();
	await expect(page.locator('.lines li .new').first()).toBeVisible({ timeout: 60_000 });
	await page.getByRole('button', { name: 'Voice it' }).click();
	await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({ timeout: 90_000 });
	const [download] = await Promise.all([
		page.waitForEvent('download', { timeout: 90_000 }),
		page.getByRole('button', { name: 'Download' }).click()
	]);
	const path = join(mkdtempSync(join(tmpdir(), 'blr-trim-out-')), 'out.mp4');
	await download.saveAs(path);
	const probe = JSON.parse(
		execFileSync('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', path], {
			encoding: 'utf8'
		})
	) as { format: { duration: string } };
	expect(Number(probe.format.duration)).toBeGreaterThan(108);
	expect(Number(probe.format.duration)).toBeLessThan(112);
});
