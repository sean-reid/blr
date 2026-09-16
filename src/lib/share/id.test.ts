import { describe, expect, it } from 'vitest';
import { ID_ALPHABET, ID_LENGTH, isId, newId } from './id';

describe('share ids', () => {
	it('uses an unambiguous alphabet', () => {
		expect(ID_ALPHABET).not.toMatch(/[01oOiIlL]/);
		expect(ID_ALPHABET).toBe([...new Set(ID_ALPHABET)].join(''));
	});

	it('is ten characters from the alphabet', () => {
		for (let i = 0; i < 200; i++) {
			const id = newId();
			expect(id).toHaveLength(ID_LENGTH);
			expect(isId(id)).toBe(true);
		}
	});

	it('does not repeat', () => {
		const ids = new Set(Array.from({ length: 500 }, () => newId()));
		expect(ids.size).toBe(500);
	});

	it('skips bytes that would bias the alphabet', () => {
		let calls = 0;
		const id = newId((n) => {
			calls++;
			return new Uint8Array(n).fill(calls === 1 ? 255 : 0);
		});
		expect(id).toBe('2222222222');
		expect(calls).toBe(2);
	});

	it('rejects malformed ids', () => {
		expect(isId('short')).toBe(false);
		expect(isId('0123456789')).toBe(false);
		expect(isId('../etc/pwd')).toBe(false);
		expect(isId('23456789ab')).toBe(true);
	});
});
