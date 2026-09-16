export interface ShareLine {
	speaker: number;
	start: number;
	end: number;
	original: string;
	text: string;
}

export interface ShareResult {
	id: string;
	url: string;
	expires: string;
}

export const SPEAKER_LETTERS = 'ABCDEFGH';

export function speakerLetter(speaker: number): string {
	return SPEAKER_LETTERS[speaker] ?? '?';
}
