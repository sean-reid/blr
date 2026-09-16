export const MODEL_URL = '/models/kim-vocal-2.onnx';
export const MODEL_SHA256 = 'ce74ef3b6a6024ce44211a07be9cf8bc6d87728cc852a68ab34eb8e58cde9c8b';
export const MODEL_BYTES = 66_759_214;
export const RUNTIME_URL = '/models/ort/1.30.0/';

// The worker imports the runtime loader by URL, so it needs an absolute one.
export function runtimeUrl(): string {
	return new URL(RUNTIME_URL, location.href).href;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
