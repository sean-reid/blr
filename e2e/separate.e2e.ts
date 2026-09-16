import { expect, test } from '@playwright/test';
import { decodeWav } from '../src/lib/audio/wav.ts';
import {
	CLIP,
	MODEL,
	downloadStem,
	fixturesPresent,
	runSeparation,
	serveModel,
	speechToGapDb
} from './separation-fixtures.ts';

const SECONDS = 10;

test.skip(!fixturesPresent(), `needs the model at ${MODEL} and the clip at ${CLIP}`);

test('separates speech from a 10 s clip on the wasm provider', async ({ page }) => {
	test.setTimeout(10 * 60 * 1000);
	await serveModel(page);
	await page.goto('/dev/separate');
	await expect(page.getByRole('heading', { name: 'Separation test bench' })).toBeVisible();
	const clip = await runSeparation(page, 'WASM only', SECONDS);

	const status = page.locator('.status');
	await expect(status).toHaveAttribute('data-status', /done|error/, { timeout: 8 * 60 * 1000 });
	expect(await page.getByRole('alert').allTextContents(), 'separation failed').toEqual([]);
	await expect(page.locator('[data-field=provider]')).toHaveText('wasm');
	await page.screenshot({ path: 'test-results/separate-done.png', fullPage: true });

	const vocals = decodeWav(new Uint8Array(await downloadStem(page, 'vocals')).buffer);
	expect(vocals.sampleRate).toBe(clip.sampleRate);
	expect(vocals.channels[0].length).toBe(clip.channels[0].length);

	const mixDb = speechToGapDb(clip.channels, clip.sampleRate, SECONDS);
	const vocalDb = speechToGapDb(vocals.channels, vocals.sampleRate, SECONDS);
	console.log(`speech/gap ratio: mix ${mixDb.toFixed(1)} dB, vocals ${vocalDb.toFixed(1)} dB`);
	expect(vocalDb - mixDb).toBeGreaterThanOrEqual(6);
});
