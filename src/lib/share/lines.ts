import type { Line } from '$lib/transcript/types';
import type { ShareLine } from './types';

export function toShareLines(lines: Line[], text: (id: string) => string): ShareLine[] {
	return lines
		.map((l) => ({
			speaker: l.speaker,
			start: l.start,
			end: l.end,
			original: l.text,
			text: text(l.id).trim()
		}))
		.filter((l) => l.text);
}
