export interface NovaWord {
	word: string;
	punctuated_word?: string;
	start: number;
	end: number;
	confidence: number;
	speaker?: number;
}

export interface NovaResponse {
	results: {
		channels: { alternatives: { transcript: string; words: NovaWord[] }[] }[];
		utterances?: { speaker?: number; start: number; end: number; transcript: string }[];
	};
}

export interface AiClient {
	transcribe(audio: ReadableStream<Uint8Array>, contentType: string): Promise<NovaResponse>;
}
