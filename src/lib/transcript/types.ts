export interface Word {
	word: string;
	punctuated: string;
	start: number;
	end: number;
	confidence: number;
	speaker: number;
}

export interface Transcript {
	words: Word[];
	duration: number;
}

export interface Line {
	id: string;
	speaker: number;
	start: number;
	end: number;
	words: Word[];
	text: string;
}
