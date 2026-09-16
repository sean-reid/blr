import { describe, expect, it } from 'vitest';
import { lineRequest, rank, rewriteAll } from './client';
import { VisemeIndex } from '../viseme/index';
import data from '../viseme/data/words.json';
import { groupLines } from '../transcript/lines';
import { normalizeNova } from '../transcript/normalize';
import sample from '../server/fixtures/nova-sample.json';
import type { RewriteRequest } from './types';

const index = new VisemeIndex(data);
const lines = groupLines(normalizeNova(sample, 25));

describe('lineRequest', () => {
	it('carries a per-word syllable pattern and lip cues for the line', () => {
		const req = lineRequest(index, lines[3]);
		expect(req.original).toBe('And by the way, how are things going in school?');
		expect(req.pattern.length).toBeGreaterThanOrEqual(1);
		expect(req.pattern.every((n) => n >= 1)).toBe(true);
		expect(req.lips).toEqual([2]);
	});
});

describe('rank', () => {
	it('prefers a reading that follows the pattern, word for word', () => {
		const word = (text: string, start: number, end: number) => ({
			word: text,
			punctuated: text,
			start,
			end,
			confidence: 1,
			speaker: 0
		});
		const line = {
			id: 'x',
			speaker: 0,
			start: 0,
			end: 0.45,
			text: 'bad men',
			words: [word('bad', 0, 0.2), word('men', 0.2, 0.36)]
		};
		const r = rank(index, line, ['The committee has adjourned for lunch.', 'mad ben', 'sad hen']);
		expect(r[0].fits).toBe(true);
		expect(r[0].text).toBe('mad ben');
		expect(r[r.length - 1].fits).toBe(false);
	});

	it('penalises reusing the original words', () => {
		const line = lines[3];
		const r = rank(index, line, ['And by the way, how are things going in school?']);
		expect(r[0].score).toBeLessThan(0.5);
	});
});

describe('rewriteAll', () => {
	it('batches ten lines per request, threads context and ranks every line', async () => {
		const calls: RewriteRequest[] = [];
		const many = [...lines, ...lines.map((l) => ({ ...l, id: `${l.id}b` }))];
		const fetcher = (async (_url: string, init?: RequestInit) => {
			const req = JSON.parse(String(init?.body)) as RewriteRequest;
			calls.push(req);
			return new Response(
				JSON.stringify({
					lines: req.lines.map((l) => ({ id: l.id, options: ['Bring me the moose.', 'Hi.'] }))
				})
			);
		}) as typeof fetch;
		const out = await rewriteAll(index, many, 'pg13', fetcher);
		expect(calls.length).toBe(2);
		expect(calls[0].lines.length).toBe(10);
		expect(calls[0].options).toBe(6);
		expect(calls[0].speakers).toBe(2);
		expect(calls[1].context?.length).toBe(2);
		expect(out.size).toBe(18);
		expect(out.get('l3')?.length).toBe(2);
	});
});
