import { describe, expect, it } from 'vitest';
import { groupLines, smoothSpeakers, speakersOf } from './lines';
import { normalizeNova } from './normalize';
import sample from '../server/fixtures/nova-sample.json';

const transcript = normalizeNova(sample, 25);

describe('normalizeNova', () => {
	it('keeps word timing, punctuation and speaker', () => {
		expect(transcript.words.length).toBe(71);
		const first = transcript.words[0];
		expect(first.word).toBe('knew');
		expect(first.punctuated).toBe('Knew');
		expect(first.start).toBeGreaterThanOrEqual(0);
		expect(first.end).toBeGreaterThan(first.start);
		expect(first.speaker).toBe(0);
	});
});

describe('smoothSpeakers', () => {
	const w = (word: string, start: number, speaker: number) => ({
		word,
		punctuated: word,
		start,
		end: start + 0.2,
		confidence: 1,
		speaker
	});

	it('folds a short flip between two runs of the same speaker', () => {
		const out = smoothSpeakers([w('a', 0, 0), w('b', 0.25, 1), w('c', 0.5, 0), w('d', 0.75, 0)]);
		expect(out.map((x) => x.speaker)).toEqual([0, 0, 0, 0]);
	});

	it('keeps a flip that sits behind a real pause', () => {
		const out = smoothSpeakers([w('a', 0, 0), w('b', 1.0, 1), w('c', 2.0, 0)]);
		expect(out.map((x) => x.speaker)).toEqual([0, 1, 0]);
	});

	it('keeps a two-word opener when the speaker stays changed after it', () => {
		const out = smoothSpeakers([
			w('a', 0, 0),
			w('b', 0.25, 0),
			w('c', 0.5, 1),
			w('d', 0.75, 1),
			w('e', 1, 1)
		]);
		expect(out.map((x) => x.speaker)).toEqual([0, 0, 1, 1, 1]);
	});

	it('attaches a single trailing stray word to a long run before it', () => {
		const out = smoothSpeakers([w('a', 0, 1), w('b', 0.25, 1), w('c', 0.5, 1), w('d', 0.75, 0)]);
		expect(out.map((x) => x.speaker)).toEqual([1, 1, 1, 1]);
		const short = smoothSpeakers([w('a', 0, 1), w('b', 0.25, 1), w('d', 0.5, 0)]);
		expect(short.map((x) => x.speaker)).toEqual([1, 1, 0]);
	});

	it('hands a sentence-final tail to the next speaker when it runs straight on', () => {
		const words = [
			{ ...w('fine.', 0, 0), punctuated: 'fine.' },
			w('well', 0.25, 0),
			w('you', 0.5, 0),
			w('know', 0.75, 1),
			w('son', 1.0, 1),
			w('right', 1.25, 1)
		];
		expect(smoothSpeakers(words).map((x) => x.speaker)).toEqual([0, 1, 1, 1, 1, 1]);
	});

	it('does not mutate its input', () => {
		const input = [w('a', 0, 0), w('b', 0.25, 1), w('c', 0.5, 0)];
		smoothSpeakers(input);
		expect(input[1].speaker).toBe(1);
	});
});

describe('groupLines', () => {
	const lines = groupLines(transcript);

	it('never mixes speakers inside a line', () => {
		for (const l of lines) expect(new Set(l.words.map((w) => w.speaker)).size).toBe(1);
	});

	it('keeps lines in time order and non-overlapping', () => {
		for (let i = 1; i < lines.length; i++) {
			expect(lines[i].start).toBeGreaterThanOrEqual(lines[i - 1].end - 1e-6);
		}
	});

	it('splits at sentence ends and long gaps', () => {
		const texts = lines.map((l) => l.text);
		expect(texts).toContain('And by the way, how are things going in school?');
		expect(texts.some((t) => t.startsWith('But school here'))).toBe(true);
		expect(lines.every((l) => l.words.length <= 12)).toBe(true);
	});

	it('folds the sample\'s "Well, you" slip and trailing "to" into their neighbours', () => {
		const texts = lines.map((l) => l.text);
		expect(texts.some((t) => t.startsWith('Well, you know, son'))).toBe(true);
		expect(texts).not.toContain('to');
		expect(lines.length).toBe(9);
	});

	it('finds both speakers', () => {
		expect(speakersOf(lines)).toEqual([0, 1]);
	});

	it('handles an empty transcript', () => {
		expect(groupLines({ words: [], duration: 0 })).toEqual([]);
	});
});
