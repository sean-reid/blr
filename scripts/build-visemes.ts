// Builds src/lib/viseme/data/words.json from CMUdict, Norvig's unigram
// counts, and the LDNOOBW word list. Sources are pinned to commits.
// Run: pnpm build:visemes
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CACHE = '.cache';
const OUT = 'src/lib/viseme/data/words.json';
const LIMIT = 40_000;

const SOURCES = {
	cmudict:
		'https://raw.githubusercontent.com/cmusphinx/cmudict/0f8072f814306c5ee4fbf992ed853601b12c01f9/cmudict.dict',
	counts: 'https://norvig.com/ngrams/count_1w.txt',
	banned:
		'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/4638b970cb8d9d82789564fcba1f4a1eb508ff1a/en'
};

// Mild profanity stays in the dictionary, tagged so the clean toggle can drop it.
const MILD = new Set([
	'damn',
	'dammit',
	'damned',
	'hell',
	'crap',
	'crappy',
	'ass',
	'arse',
	'bastard',
	'piss',
	'pissed',
	'bloody',
	'bugger',
	'butt'
]);

async function fetchCached(name: string, url: string): Promise<string> {
	mkdirSync(CACHE, { recursive: true });
	const path = join(CACHE, name);
	if (existsSync(path)) return readFileSync(path, 'utf8');
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: ${res.status}`);
	const text = await res.text();
	writeFileSync(path, text);
	return text;
}

const [dict, counts, bannedText] = await Promise.all([
	fetchCached('cmudict.dict', SOURCES.cmudict),
	fetchCached('count_1w.txt', SOURCES.counts),
	fetchCached('ldnoobw_en.txt', SOURCES.banned)
]);

const phones = new Map<string, string>();
for (const line of dict.split('\n')) {
	if (!line || line.startsWith(';;;')) continue;
	const [head, ...rest] = line.split(' ');
	if (head.includes('(')) continue;
	if (!/^[a-z][a-z']*$/.test(head)) continue;
	const pron = rest
		.join(' ')
		.replace(/\s*#.*$/, '')
		.replace(/[0-2]/g, '');
	phones.set(head, pron);
}

const banned = new Set(
	bannedText
		.split('\n')
		.map((w) => w.trim().toLowerCase())
		.filter(Boolean)
);

const words: string[] = [];
const profane: number[] = [];
for (const line of counts.split('\n')) {
	const word = line.split('\t')[0];
	if (!word) continue;
	if (word.length === 1 && word !== 'a' && word !== 'i') continue;
	const pron = phones.get(word);
	if (!pron) continue;
	if (banned.has(word) && !MILD.has(word)) continue;
	if (MILD.has(word)) profane.push(words.length);
	words.push(`${word}|${pron}`);
	if (words.length >= LIMIT) break;
}

writeFileSync(OUT, JSON.stringify({ v: 1, words, profane }));
console.log(`${words.length} words, ${profane.length} tagged profane, wrote ${OUT}`);
