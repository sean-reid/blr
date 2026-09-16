import { describe, expect, it } from 'vitest';
import { responseSchema, userMessage, validate } from './prompt';
import type { RewriteRequest } from './types';

const req: RewriteRequest = {
	speakers: 2,
	tone: 'pg13',
	options: 4,
	lines: [{ id: 'l0', speaker: 0, original: 'Oh, okay, dad.', pattern: [1, 2, 1], lips: [3] }]
};

describe('userMessage', () => {
	it('states the option count, syllables and cues per line', () => {
		const m = userMessage(req);
		expect(m).toContain('2 people are talking, speakers 0 to 1. Write 4 options per line.');
		expect(m).toContain(
			'Line l0, speaker 0: 1 + 2 + 1 = 4 syllables; lips press at word 3 of the original. Original: "Oh, okay, dad."'
		);
		expect(m).not.toContain('No profanity');
	});

	it('adds the clean note and context when present', () => {
		const m = userMessage({
			...req,
			tone: 'clean',
			context: [{ speaker: 1, text: 'hello there' }]
		});
		expect(m).toContain('No profanity at all in this job.');
		expect(m).toContain('speaker 1: hello there');
	});
});

describe('responseSchema', () => {
	it('pins ids to the requested lines', () => {
		expect(responseSchema(req).properties.lines.items.properties.id.enum).toEqual(['l0']);
	});
});

describe('validate', () => {
	it('trims, dedupes and drops junk options', () => {
		const out = validate(req, {
			lines: [{ id: 'l0', options: [' So,  a  goat. ', 'So, a goat.', 7, '', 'x'.repeat(300)] }]
		});
		expect(out.lines[0].options).toEqual(['So, a goat.']);
	});

	it('returns empty options for missing lines', () => {
		expect(validate(req, { garbage: true }).lines[0].options).toEqual([]);
	});
});
