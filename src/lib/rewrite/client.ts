import { normalizeWord, type VisemeIndex } from '../viseme/index';
import { alignWords } from '../viseme/align';
import { totalSyllables, wordPlan } from '../voice/plan';
import type { Line } from '../transcript/types';
import type { LineRequest, RewriteRequest, RewriteResponse, Tone } from './types';

export const LEVEL = 'loose';
export const OPTIONS = 6;
export const DEFAULT_PACE = 6;
export const FIT_TOLERANCE = 1;
const BATCH = 10;

export interface Ranked {
	text: string;
	score: number;
	perWord: number[];
	fits: boolean;
}

export function lineRequest(index: VisemeIndex, line: Line, pace = DEFAULT_PACE): LineRequest {
	const { pattern, lips } = wordPlan(index, line, pace);
	return { id: line.id, speaker: line.speaker, original: line.text, pattern, lips };
}

export function tokens(text: string): string[] {
	return text.split(/\s+/).map(normalizeWord).filter(Boolean);
}

// Mouth shapes decide the order among readings whose syllable count fills
// the mouth movement; readings that miss the count sort below them.
export function rank(
	index: VisemeIndex,
	line: Line,
	options: string[],
	pace = DEFAULT_PACE
): Ranked[] {
	const originals = line.words.map((w) => normalizeWord(w.word));
	const target = originals.flatMap((w) => index.lookup(w, LEVEL).visemes);
	const wanted = totalSyllables(wordPlan(index, line, pace).pattern);
	const originalSet = new Set(originals.filter((w) => w.length > 3));
	return options
		.map((text) => {
			const words = tokens(text);
			const looked = words.map((w) => index.lookup(w, LEVEL));
			const a = alignWords(
				target,
				looked.map((l) => l.visemes)
			);
			const count = looked.reduce((n, l) => n + l.syllables, 0);
			const off = Math.abs(count - wanted);
			const reuse = words.filter((w) => originalSet.has(w)).length;
			const score = Math.max(0, a.score - 0.05 * off - 0.2 * reuse);
			return { text, score, perWord: a.perWord, fits: off <= FIT_TOLERANCE };
		})
		.sort((x, y) => Number(y.fits) - Number(x.fits) || y.score - x.score);
}

export function scoreText(index: VisemeIndex, line: Line, text: string): Ranked {
	return rank(index, line, [text])[0] ?? { text, score: 0, perWord: [], fits: false };
}

export async function rewriteAll(
	index: VisemeIndex,
	lines: Line[],
	tone: Tone,
	fetcher: typeof fetch = fetch,
	pace = DEFAULT_PACE
): Promise<Map<string, Ranked[]>> {
	const out = new Map<string, Ranked[]>();
	for (let i = 0; i < lines.length; i += BATCH) {
		const batch = lines.slice(i, i + BATCH);
		const context = lines
			.slice(Math.max(0, i - 2), i)
			.map((l) => ({ speaker: l.speaker, text: out.get(l.id)?.[0]?.text ?? '' }))
			.filter((c) => c.text);
		const res = await post(
			{
				speakers: speakerCount(lines),
				lines: batch.map((l) => lineRequest(index, l, pace)),
				tone,
				options: OPTIONS,
				context
			},
			fetcher
		);
		for (const l of batch) {
			const options = res.lines.find((r) => r.id === l.id)?.options ?? [];
			out.set(l.id, rank(index, l, options, pace));
		}
	}
	return out;
}

export async function rewriteOne(
	index: VisemeIndex,
	line: Line,
	neighbours: { speaker: number; text: string }[],
	tone: Tone,
	fetcher: typeof fetch = fetch,
	pace = DEFAULT_PACE
): Promise<Ranked[]> {
	const res = await post(
		{
			speakers: line.speaker + 1,
			lines: [lineRequest(index, line, pace)],
			tone,
			options: OPTIONS,
			context: neighbours.filter((n) => n.text)
		},
		fetcher
	);
	return rank(index, line, res.lines[0]?.options ?? [], pace);
}

function speakerCount(lines: Line[]): number {
	return new Set(lines.map((l) => l.speaker)).size;
}

async function post(req: RewriteRequest, fetcher: typeof fetch): Promise<RewriteResponse> {
	const res = await fetcher('/api/rewrite', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(req)
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { message?: string } | null;
		throw new Error(body?.message ?? res.statusText);
	}
	return (await res.json()) as RewriteResponse;
}
