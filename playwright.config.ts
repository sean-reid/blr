import { defineConfig } from '@playwright/test';

const port = Number(process.env.PW_PORT ?? 4173);
const url = `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	webServer: {
		command: `pnpm build && pnpm preview --host 127.0.0.1 --port ${port} --strictPort`,
		url,
		reuseExistingServer: !process.env.CI
	},
	use: { baseURL: url, channel: 'chrome' },
	reporter: [['list'], ['html', { open: 'never' }]]
});
