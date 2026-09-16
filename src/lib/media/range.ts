export interface Range {
	start: number;
	end: number;
}

export const MAX_SECONDS = 3 * 60;

export function clampRange(r: Range, duration: number, max = MAX_SECONDS): Range {
	const start = Math.max(0, Math.min(r.start, duration));
	const end = Math.max(start + 1, Math.min(r.end, duration, start + max));
	return { start, end: Math.min(end, duration) };
}

export function initialRange(duration: number, max = MAX_SECONDS): Range | null {
	if (duration <= max) return null;
	return { start: 0, end: max };
}

export function fmtClock(s: number): string {
	const m = Math.floor(s / 60);
	const r = Math.floor(s - m * 60);
	return `${m}:${String(r).padStart(2, '0')}`;
}
