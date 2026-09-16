export { SPEAKER_LETTERS, speakerLetter } from '$lib/transcript/names';

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
