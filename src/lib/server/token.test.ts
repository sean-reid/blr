import { describe, expect, it } from 'vitest';
import { mint, TOKEN_TTL, verify } from './token';

const SECRET = 'test-secret';
const NOW = 1_800_000_000_000;

describe('token', () => {
	it('mints a token that verifies until it expires', async () => {
		const { token, expires } = await mint(SECRET, NOW);
		expect(expires).toBe(NOW + TOKEN_TTL);
		expect(await verify(token, SECRET, NOW)).toBe(true);
		expect(await verify(token, SECRET, NOW + TOKEN_TTL - 1)).toBe(true);
		expect(await verify(token, SECRET, NOW + TOKEN_TTL)).toBe(false);
	});

	it('rejects a token signed with another secret', async () => {
		const { token } = await mint('other', NOW);
		expect(await verify(token, SECRET, NOW)).toBe(false);
	});

	it('rejects a tampered expiry or signature', async () => {
		const { token } = await mint(SECRET, NOW);
		const [exp, sig] = token.split('.');
		expect(await verify(`${Number(exp) + 60_000}.${sig}`, SECRET, NOW)).toBe(false);
		const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
		expect(await verify(`${exp}.${flipped}`, SECRET, NOW)).toBe(false);
		expect(await verify(`${token}.x`, SECRET, NOW)).toBe(false);
	});

	it('rejects garbage', async () => {
		for (const bad of ['', 'x', '123', '.', 'abc.def', '123.%%%'])
			expect(await verify(bad, SECRET, NOW)).toBe(false);
	});
});
