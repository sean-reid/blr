export interface Voice {
	id: string;
	label: string;
}

export const VOICES: Voice[] = [
	{ id: 'orion', label: 'Orion' },
	{ id: 'luna', label: 'Luna' },
	{ id: 'angus', label: 'Angus' },
	{ id: 'stella', label: 'Stella' },
	{ id: 'zeus', label: 'Zeus' },
	{ id: 'athena', label: 'Athena' },
	{ id: 'arcas', label: 'Arcas' },
	{ id: 'hera', label: 'Hera' },
	{ id: 'perseus', label: 'Perseus' },
	{ id: 'asteria', label: 'Asteria' },
	{ id: 'helios', label: 'Helios' },
	{ id: 'orpheus', label: 'Orpheus' }
];

export const VOICE_IDS = new Set(VOICES.map((v) => v.id));

export function defaultVoice(speaker: number): string {
	return VOICES[speaker % VOICES.length].id;
}
