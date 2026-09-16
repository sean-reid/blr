export const SPEAKER_LETTERS = 'ABCDEFGH';

export type Names = Record<number, string>;

export function speakerLetter(speaker: number): string {
	return SPEAKER_LETTERS[speaker] ?? '?';
}

export function speakerName(speaker: number, names: Names = {}): string {
	return names[speaker]?.trim() || speakerLetter(speaker);
}

export function speakerTitle(speaker: number, names: Names = {}): string {
	return names[speaker]?.trim() || `Speaker ${speakerLetter(speaker)}`;
}
