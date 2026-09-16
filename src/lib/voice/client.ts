export async function speak(
	text: string,
	voice: string,
	fetcher: typeof fetch = fetch
): Promise<ArrayBuffer> {
	const res = await fetcher('/api/speak', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ text, voice })
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { message?: string } | null;
		throw new Error(body?.message ?? res.statusText);
	}
	return res.arrayBuffer();
}

export type Samples = Float32Array & { rate: number };

export async function decodeSpeech(bytes: ArrayBuffer): Promise<Samples> {
	const ctx = new AudioContext();
	try {
		const buffer = await ctx.decodeAudioData(bytes);
		return Object.assign(buffer.getChannelData(0).slice(), { rate: buffer.sampleRate });
	} finally {
		await ctx.close();
	}
}
