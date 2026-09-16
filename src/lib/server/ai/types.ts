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

export interface ChatRequest {
	system: string;
	user: string;
	schema: object;
	maxTokens: number;
	temperature: number;
}

export interface Speech {
	body: ReadableStream<Uint8Array> | ArrayBuffer;
	contentType: string;
}

export interface AiClient {
	transcribe(audio: ReadableStream<Uint8Array>, contentType: string): Promise<NovaResponse>;
	chatJson(req: ChatRequest): Promise<unknown>;
	speak(text: string, voice: string): Promise<Speech>;
}
