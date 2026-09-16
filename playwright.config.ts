import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	webServer: {
		command: 'pnpm build && pnpm preview --host 127.0.0.1',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI
	},
	use: { baseURL: 'http://127.0.0.1:4173', channel: 'chrome' },
	reporter: [['list'], ['html', { open: 'never' }]]
});
