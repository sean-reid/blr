import { describe, expect, it } from 'vitest';
import { lazy, STALE_MESSAGE } from './lazy';

describe('lazy', () => {
	it('passes results and unrelated errors through', async () => {
		expect(await lazy(async () => 7)).toBe(7);
		await expect(lazy(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
	});

	it('translates a failed module import into the reload message', async () => {
		for (const msg of [
			'Importing a module script failed.',
			'Failed to fetch dynamically imported module: https://x/y.js',
			'error loading dynamically imported module'
		]) {
			await expect(lazy(async () => Promise.reject(new TypeError(msg)))).rejects.toThrow(
				STALE_MESSAGE
			);
		}
	});
});
