export const NEURONS = { transcribePerSecond: 8, rewrite: 170, speak: 15 } as const;

export const DEFAULT_DAILY_NEURONS = 9000;

const KEEP_SECONDS = 2 * 24 * 60 * 60;

export interface Counter {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export function dayKey(now: number): string {
	return `neurons:${new Date(now).toISOString().slice(0, 10)}`;
}

export function transcribeNeurons(seconds: number): number {
	return Math.ceil(Math.max(0, seconds) * NEURONS.transcribePerSecond);
}

/** Adds an estimate to today's counter. Returns false, without adding, once the limit is passed. */
export async function charge(
	kv: Counter,
	neurons: number,
	limit: number,
	now = Date.now()
): Promise<boolean> {
	const key = dayKey(now);
	const used = Number(await kv.get(key)) || 0;
	if (used + neurons > limit) return false;
	try {
		await kv.put(key, String(used + neurons), { expirationTtl: KEEP_SECONDS });
	} catch (e) {
		// KV takes one write a second per key; a lost estimate under a burst is
		// cheaper than a failed render.
		console.warn('budget write skipped:', e instanceof Error ? e.message : e);
	}
	return true;
}
