import { encodeWav16 } from '../media/audio';
import type { Span } from './warp';

// Asks the server where each word of a synthesised line was spoken.
export async function alignSpeech(
	samples: Float32Array,
	rate: number,
	text: string,
	fetcher: typeof fetch = fetch
): Promise<Span[]> {
	const duration = samples.length / rate;
	const params = new URLSearchParams({ text, duration: duration.toFixed(3) });
	const res = await fetcher(`/api/align?${params}`, {
		method: 'POST',
		headers: { 'content-type': 'audio/wav' },
		body: encodeWav16(samples, rate)
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { message?: string } | null;
		throw new Error(body?.message ?? res.statusText);
	}
	const { words } = (await res.json()) as { words: Span[] };
	return words;
}
