import { CLASSES, dedupe, phonesToVisemes, syllableCount, toLevel, type Level } from './classes';
import { spellingSyllables, spellingToVisemes } from './spelling';

export interface WordData {
	v: number;
	words: string[];
	profane: number[];
}

export interface Entry {
	word: string;
	phones: string[];
	rank: number;
	profane: boolean;
}

export interface Candidate {
	word: string;
	score: number;
	rank: number;
	profane: boolean;
}

export interface Lookup {
	visemes: string[];
	syllables: number;
	inDictionary: boolean;
}

export interface CandidateOptions {
	limit?: number;
	clean?: boolean;
	allowSplit?: boolean;
}

export function normalizeWord(raw: string): string {
	return raw
		.toLowerCase()
		.replace(/[’‘]/g, "'")
		.replace(/[^a-z']/g, '')
		.replace(/^'+|'+$/g, '');
}

export function editDistance(a: readonly string[], b: readonly string[]): number {
	const m = a.length;
	const n = b.length;
	let prev = new Array<number>(n + 1);
	let cur = new Array<number>(n + 1);
	for (let j = 0; j <= n; j++) prev[j] = j;
	for (let i = 1; i <= m; i++) {
		cur[0] = i;
		for (let j = 1; j <= n; j++) {
			const sub = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
			cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, sub);
		}
		[prev, cur] = [cur, prev];
	}
	return prev[n];
}

export function similarity(a: readonly string[], b: readonly string[]): number {
	const len = Math.max(a.length, b.length);
	if (len === 0) return 1;
	return 1 - editDistance(a, b) / len;
}

export class VisemeIndex {
	readonly entries: Entry[];
	private readonly byWord = new Map<string, Entry>();
	private readonly byKey: Record<Level, Map<string, Entry[]>> = {
		strict: new Map(),
		loose: new Map()
	};

	constructor(data: WordData) {
		const profane = new Set(data.profane);
		this.entries = data.words.map((line, rank) => {
			const [word, phones] = line.split('|');
			return { word, phones: phones.split(' '), rank, profane: profane.has(rank) };
		});
		for (const e of this.entries) {
			this.byWord.set(e.word, e);
			for (const level of ['strict', 'loose'] as Level[]) {
				const key = phonesToVisemes(e.phones, level).join(' ');
				const list = this.byKey[level].get(key);
				if (list) list.push(e);
				else this.byKey[level].set(key, [e]);
			}
		}
	}

	entry(word: string): Entry | undefined {
		return this.byWord.get(normalizeWord(word));
	}

	lookup(word: string, level: Level): Lookup {
		const e = this.entry(word);
		if (e) {
			return {
				visemes: phonesToVisemes(e.phones, level),
				syllables: syllableCount(e.phones),
				inDictionary: true
			};
		}
		return {
			visemes: toLevel(spellingToVisemes(word), level),
			syllables: spellingSyllables(word),
			inDictionary: false
		};
	}

	candidates(word: string, level: Level, opts: CandidateOptions = {}): Candidate[] {
		const { limit = 25, clean = false, allowSplit = true } = opts;
		const target = this.lookup(word, level);
		const self = this.entry(word);
		const seen = new Set<string>();
		const out: Candidate[] = [];

		const accept = (e: Entry, score: number) => {
			if (seen.has(e.word)) return;
			if (self && (e.word === self.word || samePhones(e.phones, self.phones))) return;
			if (clean && e.profane) return;
			seen.add(e.word);
			out.push({ word: e.word, score, rank: e.rank, profane: e.profane });
		};

		const exact = this.byKey[level].get(target.visemes.join(' ')) ?? [];
		for (const e of exact) accept(e, 1);

		if (out.length < limit && allowSplit && target.visemes.length >= 3) {
			for (const [a, b] of this.splits(target.visemes, level)) {
				const w = `${a.word} ${b.word}`;
				if (seen.has(w)) continue;
				if (clean && (a.profane || b.profane)) continue;
				seen.add(w);
				out.push({
					word: w,
					score: 1,
					rank: Math.max(a.rank, b.rank),
					profane: a.profane || b.profane
				});
				if (out.length >= limit) break;
			}
		}

		if (out.length < limit) {
			for (const e of this.neighbours(target.visemes, level))
				accept(e, similarity(target.visemes, phonesToVisemes(e.phones, level)));
		}

		if (out.length === 0) {
			let best: Entry | null = null;
			let bestScore = -1;
			for (const e of this.entries) {
				if (syllableCount(e.phones) !== target.syllables) continue;
				const s = similarity(target.visemes, phonesToVisemes(e.phones, level));
				if (s > bestScore) {
					bestScore = s;
					best = e;
				}
			}
			if (best) accept(best, bestScore);
		}

		out.sort((a, b) => b.score - a.score || a.rank - b.rank);
		return out.slice(0, limit);
	}

	score(original: string, replacement: string, level: Level): number {
		const a = this.lookup(original, level).visemes;
		const b = replacement
			.split(/\s+/)
			.filter(Boolean)
			.flatMap((w) => this.lookup(w, level).visemes);
		return similarity(a, dedupe(b));
	}

	private splits(visemes: string[], level: Level): [Entry, Entry][] {
		const out: [Entry, Entry][] = [];
		for (let i = 1; i < visemes.length; i++) {
			const left = this.byKey[level].get(visemes.slice(0, i).join(' '));
			const right = this.byKey[level].get(visemes.slice(i).join(' '));
			if (!left || !right) continue;
			for (const a of left.slice(0, 4)) for (const b of right.slice(0, 4)) out.push([a, b]);
		}
		return out.sort((x, y) => x[0].rank + x[1].rank - (y[0].rank + y[1].rank));
	}

	private neighbours(visemes: string[], level: Level): Entry[] {
		const classes = CLASSES[level];
		const keys = new Set<string>();
		for (let i = 0; i < visemes.length; i++) {
			for (const c of classes) {
				if (c === visemes[i]) continue;
				keys.add([...visemes.slice(0, i), c, ...visemes.slice(i + 1)].join(' '));
			}
			keys.add([...visemes.slice(0, i), ...visemes.slice(i + 1)].join(' '));
		}
		for (let i = 0; i <= visemes.length; i++) {
			for (const c of classes) keys.add([...visemes.slice(0, i), c, ...visemes.slice(i)].join(' '));
		}
		const out: Entry[] = [];
		for (const k of keys) {
			const list = this.byKey[level].get(k);
			if (list) out.push(...list);
		}
		return out;
	}
}

function samePhones(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((p, i) => p === b[i]);
}
