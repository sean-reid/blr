import { describe, expect, it } from 'vitest';
import { MODEL_URL, RUNTIME_URL, sha256Hex } from './config';

describe('separation config', () => {
	it('hashes bytes to lowercase hex', async () => {
		const hex = await sha256Hex(new TextEncoder().encode('abc').buffer as ArrayBuffer);
		expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
	});

	it('serves model and runtime from the same origin', () => {
		expect(MODEL_URL.startsWith('/models/')).toBe(true);
		expect(RUNTIME_URL.startsWith('/models/ort/')).toBe(true);
		expect(RUNTIME_URL.endsWith('/')).toBe(true);
	});
});
