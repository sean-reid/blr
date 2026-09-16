import { describe, expect, it } from 'vitest';
import { lineRequest, rank, rewriteAll } from './client';
import { VisemeIndex } from '$lib/viseme/index';
import data from '$lib/viseme/data/words.json';
import { groupLines } from '$lib/transcript/lines';
import { normalizeNova } from '$lib/transcript/normalize';
import sample from '$lib/server/fixtures/nova-sample.json';
import type { RewriteRequest } from './types';

const index = new VisemeIndex(data);
const lines = groupLines(normalizeNova(sample, 25));

describe('lineRequest', () => {
	it('carries syllables and lip cues for the line', () => {
		const req = lineRequest(index, lines[3]);
		expect(req.original).toBe('And by the way, how are things going in school?');
		expect(req.syllables).toBe(11);
		expect(req.lips).toEqual([2]);
	});
});

describe('rank', () => {
	it('prefers the option whose mouth shapes and syllables match', () => {
		const line = lines[4];
		expect(line.text).toBe('Oh, okay, dad.');
		const r = rank(index, line, ['No, no way, Nat.', 'The committee has adjourned for lunch.']);
		expect(r[0].text).toBe('No, no way, Nat.');
		expect(r[0].score).toBeGreaterThan(r[1].score);
		expect(r[0].perWord.length).toBe(4);
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
		expect(calls.length).toBe(3);
		expect(calls[0].lines.length).toBe(10);
		expect(calls[0].options).toBe(6);
		expect(calls[0].speakers).toBe(2);
		expect(calls[1].context?.length).toBe(2);
		expect(out.size).toBe(22);
		expect(out.get('l3')?.length).toBe(2);
	});
});
