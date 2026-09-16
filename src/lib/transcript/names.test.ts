import { describe, expect, it } from 'vitest';
import { speakerLetter, speakerName, speakerTitle } from './names';

describe('speaker names', () => {
	it('falls back to the letter when there is no name', () => {
		expect(speakerName(0)).toBe('A');
		expect(speakerName(1, {})).toBe('B');
		expect(speakerName(9)).toBe('?');
	});

	it('treats a blank name as no name', () => {
		expect(speakerName(0, { 0: '   ' })).toBe('A');
		expect(speakerTitle(0, { 0: '' })).toBe('Speaker A');
	});

	it('uses the trimmed name when set', () => {
		expect(speakerName(1, { 1: ' Nat ' })).toBe('Nat');
		expect(speakerTitle(1, { 1: 'Nat' })).toBe('Nat');
		expect(speakerLetter(2)).toBe('C');
	});
});
