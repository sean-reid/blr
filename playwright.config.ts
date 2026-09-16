import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	webServer: { command: 'pnpm build && pnpm preview', port: 4173, reuseExistingServer: true },
	use: { baseURL: 'http://localhost:4173' },
	reporter: [['list'], ['html', { open: 'never' }]]
});
