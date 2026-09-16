import { describe, expect, it } from 'vitest';
import { groupLines, speakersOf } from './lines';
import { normalizeNova } from './normalize';
import sample from '$lib/server/fixtures/nova-sample.json';

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

	it('yields eleven lines for the sample, matching the e2e expectation', () => {
		expect(lines.length).toBe(11);
	});

	it('finds both speakers', () => {
		expect(speakersOf(lines)).toEqual([0, 1]);
	});

	it('handles an empty transcript', () => {
		expect(groupLines({ words: [], duration: 0 })).toEqual([]);
	});
});
