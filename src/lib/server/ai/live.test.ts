import { describe, expect, it } from 'vitest';
import { withRetry } from './live';

describe('withRetry', () => {
	it('retries once on a Workers AI server error', async () => {
		let calls = 0;
		const out = await withRetry(async () => {
			calls++;
			if (calls === 1) throw new Error('AiError: 8008: Internal server error');
			return 'ok';
		}, 1);
		expect(out).toBe('ok');
		expect(calls).toBe(2);
	});

	it('does not retry client errors', async () => {
		let calls = 0;
		await expect(
			withRetry(async () => {
				calls++;
				throw new Error('AiError: 5006: required properties missing');
			}, 1)
		).rejects.toThrow('5006');
		expect(calls).toBe(1);
	});
});
