export const SHARE_DAYS = 7;

export function expiresAt(now: Date = new Date()): string {
	return new Date(now.getTime() + SHARE_DAYS * 86_400_000).toISOString();
}

export function isExpired(expires: string | undefined, now: Date = new Date()): boolean {
	if (!expires) return true;
	const t = Date.parse(expires);
	return Number.isNaN(t) || t <= now.getTime();
}
