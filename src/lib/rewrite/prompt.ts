import type { RewriteRequest, RewriteResponse } from './types';

export const SYSTEM = `You write bad lip readings: new dialogue dubbed over people talking on video. The picture stays the same, so the new words have to fill the mouth movements that are already there, no more and no less.

Every line comes with a syllable count. That count is the mouth: the voice will be laid over the footage at its natural speed, so a reading with fewer syllables leaves the mouth flapping in silence and one with more runs past it. Hitting the count matters more than anything else about the line. When a line has a pause in it, the count is split, like 8 + 3: write a phrase for each part with that many syllables and a natural break between them. Where a word is marked as a lip press, that word should start with p, b or m if the sentence allows.

House style: deadpan, spoken, slightly unhinged. People calmly say strange things to each other and the other person takes it seriously. Short words, contractions, first and second person. Non sequiturs, odd confessions, petty grievances, sudden rules, weird questions. Never whimsical or cute, never a list of facts, never a sentence that ends in an adverb.

Examples, count then reading:
7 -> "Nobody likes my haircut."
8 -> "I ate a banana in bed."
6 + 5 -> "My sister has a pet lobster, and it knows my name."
3 -> "Not my dog."

Rules for every option:
- exactly the syllable count given, counted carefully; contractions like "I'm" and "don't" are one syllable
- reach the count with real content, never with padding: no "maybe", "somehow", "someday", "pretty", "just", "really" or repeated words tacked on to make up numbers; use a longer noun, a name, a place or a second clause instead
- a complete spoken line, grammatical, something a person could actually say to the other person in the room
- shares no words with the original and is not about the same subject
- the options for a line differ in subject and shape, and do not repeat subjects used for other lines
Mild language is fine. Nothing sexual, no slurs, nothing hateful.
Reply with JSON only: {"lines":[{"id":"...","options":["...", ...]}]}, one entry per line, in order.`;

export const CLEAN_NOTE = 'No profanity at all in this job.';

export function userMessage(req: RewriteRequest): string {
	const who =
		req.speakers > 1
			? `${req.speakers} people are talking, speakers 0 to ${req.speakers - 1}.`
			: 'One person is talking.';
	const parts: string[] = [`${who} Write ${req.options} options per line.`];
	if (req.tone === 'clean') parts.push(CLEAN_NOTE);
	if (req.context?.length) {
		parts.push('Already written, for continuity:');
		for (const c of req.context) parts.push(`  speaker ${c.speaker}: ${c.text}`);
	}
	for (const line of req.lines) {
		const total = line.pattern.reduce((a, b) => a + b, 0);
		const count = line.pattern.length > 1 ? `${line.pattern.join(' + ')} = ${total}` : `${total}`;
		const lips = line.lips.length
			? `; lips press at word ${line.lips.join(', ')} of the original`
			: '';
		parts.push(
			`Line ${line.id}, speaker ${line.speaker}: ${count} syllables${lips}. Original: "${line.original}"`
		);
	}
	return parts.join('\n');
}

export function responseSchema(req: RewriteRequest) {
	return {
		type: 'object',
		properties: {
			lines: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						id: { type: 'string', enum: req.lines.map((l) => l.id) },
						options: { type: 'array', items: { type: 'string' } }
					},
					required: ['id', 'options']
				}
			}
		},
		required: ['lines']
	};
}

export function validate(req: RewriteRequest, raw: unknown): RewriteResponse {
	const byId = new Map<string, string[]>();
	const rawLines = (raw as { lines?: { id?: string; options?: unknown[] }[] })?.lines ?? [];
	for (const l of rawLines) {
		if (typeof l.id !== 'string' || !Array.isArray(l.options)) continue;
		const clean = l.options
			.filter((o): o is string => typeof o === 'string')
			.map((o) => o.replace(/\s+/g, ' ').trim())
			.filter((o) => o.length > 0 && o.length < 200);
		byId.set(l.id, [...new Set(clean)]);
	}
	return { lines: req.lines.map((line) => ({ id: line.id, options: byId.get(line.id) ?? [] })) };
}
