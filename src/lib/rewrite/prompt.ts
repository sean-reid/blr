import type { RewriteRequest, RewriteResponse } from './types';

export const SYSTEM = `You write bad lip readings: new dialogue dubbed over people talking on video. The picture stays the same, so each new line has to take about as long to say as the original, and where the speaker's lips visibly press together the new line should have a p, b or m sound if that comes naturally.

House style: deadpan, spoken, slightly unhinged. People calmly say strange things to each other and the other person takes it seriously. Short words, contractions, first and second person. Non sequiturs, odd confessions, petty grievances, sudden rules, weird questions. Never whimsical or cute, never a list of facts, never a sentence that ends in an adverb.

Examples of the style, original then replacement:
"How are things going in school?" -> "Now I'm eating tuna in the pool."
"I know I have to connect it into the amplifier." -> "I'm not allowed to talk to Kevin at the aquarium."
"It just doesn't fit in." -> "My chest hurts when I sing."
"Well, you know, son." -> "Well, I'm no swan."
"This oscillator will do its work well." -> "This is a sweater made of hot dogs."

Rules for every option:
- about the same number of syllables as the original; one off is fine
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
		const lips = line.lips.length ? `; lips press at syllables ${line.lips.join(', ')}` : '';
		parts.push(
			`Line ${line.id}, speaker ${line.speaker}, ${line.syllables} syllables${lips}: "${line.original}"`
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
