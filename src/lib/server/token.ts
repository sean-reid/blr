export const TOKEN_TTL = 15 * 60 * 1000;

const enc = new TextEncoder();

async function key(secret: string, usage: KeyUsage) {
	return crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		[usage]
	);
}

function toBase64Url(bytes: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
	try {
		const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
		return Uint8Array.from(bin, (c) => c.charCodeAt(0));
	} catch {
		return null;
	}
}

export async function mint(
	secret: string,
	now = Date.now()
): Promise<{ token: string; expires: number }> {
	const expires = now + TOKEN_TTL;
	const sig = await crypto.subtle.sign(
		'HMAC',
		await key(secret, 'sign'),
		enc.encode(String(expires))
	);
	return { token: `${expires}.${toBase64Url(sig)}`, expires };
}

export async function verify(token: string, secret: string, now = Date.now()): Promise<boolean> {
	const [exp, sig, extra] = token.split('.');
	if (!exp || !sig || extra !== undefined || !/^\d+$/.test(exp)) return false;
	if (Number(exp) <= now) return false;
	const bytes = fromBase64Url(sig);
	if (!bytes) return false;
	return crypto.subtle.verify(
		'HMAC',
		await key(secret, 'verify'),
		bytes as BufferSource,
		enc.encode(exp)
	);
}
