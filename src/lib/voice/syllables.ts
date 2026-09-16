// Rough syllable count from spelling, enough to spread words over time.
export function spellingSyllables(word: string): number {
	const w = word.toLowerCase().replace(/[^a-z]/g, '');
	if (!w) return 1;
	const groups = w.match(/[aeiouy]+/g)?.length ?? 0;
	const silentE = w.length > 3 && /[^aeiou]e$/.test(w) ? 1 : 0;
	return Math.max(1, groups - silentE);
}
