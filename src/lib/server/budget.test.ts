import { describe, expect, it } from 'vitest';
import { charge, dayKey, NEURONS, transcribeNeurons, type Counter } from './budget';

function fakeKv() {
	const store = new Map<string, { value: string; ttl?: number }>();
	const kv: Counter = {
		async get(key) {
			return store.get(key)?.value ?? null;
		},
		async put(key, value, options) {
			store.set(key, { value, ttl: options?.expirationTtl });
		}
	};
	return { kv, store };
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 16, 23, 59, 0);

describe('estimates', () => {
	it('prices each call kind', () => {
		expect(NEURONS.rewrite).toBe(170);
		expect(NEURONS.speak).toBe(15);
		expect(transcribeNeurons(25.4)).toBe(204);
		expect(transcribeNeurons(0)).toBe(0);
		expect(transcribeNeurons(-3)).toBe(0);
	});
});

describe('charge', () => {
	it('accumulates under the limit and refuses past it', async () => {
		const { kv, store } = fakeKv();
		expect(await charge(kv, 170, 500, NOW)).toBe(true);
		expect(await charge(kv, 170, 500, NOW)).toBe(true);
		expect(store.get(dayKey(NOW))?.value).toBe('340');
		expect(await charge(kv, 170, 500, NOW)).toBe(false);
		expect(store.get(dayKey(NOW))?.value).toBe('340');
		expect(await charge(kv, 160, 500, NOW)).toBe(true);
	});

	it('starts a fresh counter each UTC day and expires old ones', async () => {
		const { kv, store } = fakeKv();
		expect(await charge(kv, 500, 500, NOW)).toBe(true);
		expect(await charge(kv, 1, 500, NOW)).toBe(false);
		expect(await charge(kv, 1, 500, NOW + DAY)).toBe(true);
		expect(dayKey(NOW)).toBe('neurons:2026-09-16');
		expect(dayKey(NOW + DAY)).toBe('neurons:2026-09-17');
		expect(store.get(dayKey(NOW))?.ttl).toBe((2 * DAY) / 1000);
	});
});

describe('charge under a KV write burst', () => {
	it('still allows the request when the write is rate limited', async () => {
		const kv = {
			get: async () => '100',
			put: async () => {
				throw new Error('KV PUT failed: 429 Too Many Requests');
			}
		};
		await expect(charge(kv, 10, 9000, Date.parse('2026-09-16T12:00:00Z'))).resolves.toBe(true);
	});
});
