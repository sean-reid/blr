import { test as base } from '@playwright/test';
import { MODEL_URL } from '../src/lib/audio/separate/config.ts';

// Only tests that opt in download the separation model; the rest see a 404
// and take the ducking path, which keeps the suite quick and deterministic.
export const test = base.extend<{ separation: boolean }>({
	separation: [false, { option: true }],
	page: async ({ page, separation }, use) => {
		if (!separation) await page.route(`**${MODEL_URL}`, (route) => route.fulfill({ status: 404 }));
		await use(page);
	}
});

export { expect } from '@playwright/test';
