import { speakerTitle, type Names } from '$lib/transcript/names';
import type { ShareLine } from './types';

const MIN_CUE = 0.5;

export function toVtt(lines: ShareLine[], names: Names = {}): string {
	const cues = lines
		.filter((l) => l.text.trim())
		.sort((a, b) => a.start - b.start)
		.map((l, i) => {
			const end = Math.max(l.end, l.start + MIN_CUE);
			const voice = `<v ${escapeCue(speakerTitle(l.speaker, names))}>`;
			return `${i + 1}\n${stamp(l.start)} --> ${stamp(end)}\n${voice}${escapeCue(l.text)}`;
		});
	return ['WEBVTT', ...cues].join('\n\n') + '\n';
}

export function stamp(seconds: number): string {
	const total = Math.max(0, Math.round(seconds * 1000));
	const h = Math.floor(total / 3_600_000);
	const m = Math.floor((total % 3_600_000) / 60_000);
	const s = Math.floor((total % 60_000) / 1000);
	const ms = total % 1000;
	const two = (n: number) => String(n).padStart(2, '0');
	return `${two(h)}:${two(m)}:${two(s)}.${String(ms).padStart(3, '0')}`;
}

function escapeCue(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
