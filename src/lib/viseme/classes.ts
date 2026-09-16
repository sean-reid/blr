export type Level = 'strict' | 'loose';

export type Viseme =
	'PP' | 'FF' | 'TH' | 'DD' | 'KK' | 'CH' | 'RR' | 'WW' | 'AA' | 'EH' | 'IH' | 'OH';

const STRICT: Record<string, Viseme> = {
	P: 'PP',
	B: 'PP',
	M: 'PP',
	F: 'FF',
	V: 'FF',
	TH: 'TH',
	DH: 'TH',
	T: 'DD',
	D: 'DD',
	N: 'DD',
	L: 'DD',
	S: 'DD',
	Z: 'DD',
	K: 'KK',
	G: 'KK',
	NG: 'KK',
	HH: 'KK',
	CH: 'CH',
	JH: 'CH',
	SH: 'CH',
	ZH: 'CH',
	R: 'RR',
	ER: 'RR',
	W: 'WW',
	UW: 'WW',
	UH: 'WW',
	AA: 'AA',
	AH: 'AA',
	AY: 'AA',
	AW: 'AA',
	EH: 'EH',
	AE: 'EH',
	EY: 'EH',
	IH: 'IH',
	IY: 'IH',
	Y: 'IH',
	OW: 'OH',
	AO: 'OH',
	OY: 'OH'
};

export const LOOSE_OF: Partial<Record<Viseme, string>> = {
	DD: 'H',
	KK: 'H',
	TH: 'H',
	RR: 'H',
	OH: 'O',
	WW: 'O',
	EH: 'IH'
};

export const CLASSES: Record<Level, readonly string[]> = {
	strict: ['PP', 'FF', 'TH', 'DD', 'KK', 'CH', 'RR', 'WW', 'AA', 'EH', 'IH', 'OH'],
	loose: ['PP', 'FF', 'CH', 'H', 'O', 'AA', 'IH']
};

export const VOWELS = new Set([
	'AA',
	'AE',
	'AH',
	'AO',
	'AW',
	'AY',
	'EH',
	'ER',
	'EY',
	'IH',
	'IY',
	'OW',
	'OY',
	'UH',
	'UW'
]);

export function stripStress(phone: string): string {
	return phone.replace(/[0-2]$/, '');
}

export function dedupe(v: readonly string[]): string[] {
	return v.filter((x, i) => i === 0 || v[i - 1] !== x);
}

export function toLevel(strict: readonly Viseme[], level: Level): string[] {
	if (level === 'strict') return dedupe(strict);
	return dedupe(strict.map((v) => LOOSE_OF[v] ?? v));
}

export function phonesToVisemes(phones: readonly string[], level: Level): string[] {
	const strict: Viseme[] = [];
	for (const raw of phones) {
		const v = STRICT[stripStress(raw)];
		if (v) strict.push(v);
	}
	return toLevel(strict, level);
}

export function syllableCount(phones: readonly string[]): number {
	let n = 0;
	for (const p of phones) if (VOWELS.has(stripStress(p))) n++;
	return n;
}
