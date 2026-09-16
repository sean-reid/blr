export type Tone = 'pg13' | 'clean';

export interface LineRequest {
	id: string;
	speaker: number;
	original: string;
	pattern: number[];
	lips: number[];
}

export interface RewriteRequest {
	speakers: number;
	lines: LineRequest[];
	tone: Tone;
	options: number;
	context?: { speaker: number; text: string }[];
}

export interface LineResult {
	id: string;
	options: string[];
}

export interface RewriteResponse {
	lines: LineResult[];
}
