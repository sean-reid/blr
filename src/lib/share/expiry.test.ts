import { describe, expect, it } from 'vitest';
import { expiresAt, isExpired, SHARE_DAYS } from './expiry';

describe('share expiry', () => {
	const now = new Date('2026-09-16T12:00:00.000Z');

	it('expires seven days out as an ISO timestamp', () => {
		expect(SHARE_DAYS).toBe(7);
		expect(expiresAt(now)).toBe('2026-09-23T12:00:00.000Z');
	});

	it('treats the expiry instant and anything earlier as expired', () => {
		const expires = expiresAt(now);
		expect(isExpired(expires, now)).toBe(false);
		expect(isExpired(expires, new Date('2026-09-23T11:59:59.999Z'))).toBe(false);
		expect(isExpired(expires, new Date('2026-09-23T12:00:00.000Z'))).toBe(true);
		expect(isExpired(expires, new Date('2026-10-01T00:00:00.000Z'))).toBe(true);
	});

	it('treats missing or unparseable metadata as expired', () => {
		expect(isExpired(undefined, now)).toBe(true);
		expect(isExpired('yesterday', now)).toBe(true);
	});
});
