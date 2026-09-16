import { describe, expect, it } from 'vitest';
import type { Line } from '$lib/transcript/types';
import { toShareLines } from './lines';

const line = (id: string, speaker: number, start: number, text: string): Line => ({
	id,
	speaker,
	start,
	end: start + 1,
	words: [],
	text
});

describe('toShareLines', () => {
	it('pairs each original with its current reading and drops empty ones', () => {
		const lines = [
			line('l0', 0, 0, 'Hello there'),
			line('l1', 1, 2, 'General'),
			line('l2', 0, 4, 'x')
		];
		const texts: Record<string, string> = { l0: ' Yellow hair ', l1: '', l2: 'Why' };
		expect(toShareLines(lines, (id) => texts[id] ?? '')).toEqual([
			{ speaker: 0, start: 0, end: 1, original: 'Hello there', text: 'Yellow hair' },
			{ speaker: 0, start: 4, end: 5, original: 'x', text: 'Why' }
		]);
	});
});
