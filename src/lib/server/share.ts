import { error } from '@sveltejs/kit';
import { isExpired } from '$lib/share/expiry';
import { isId } from '$lib/share/id';
import type { ShareLine } from '$lib/share/types';

export interface Share {
	id: string;
	lines: ShareLine[];
	expires: string;
}

export const MAX_LINES = 400;
export const MAX_TEXT = 300;

export function shareBucket(platform: App.Platform | undefined): R2Bucket {
	const bucket = platform?.env?.SHARE;
	if (!bucket) error(503, 'Sharing is not configured.');
	return bucket;
}

export async function loadShare(bucket: R2Bucket, id: string): Promise<Share> {
	if (!isId(id)) error(404, 'Nothing here.');
	const obj = await bucket.get(`${id}/transcript.json`);
	if (!obj || isExpired(obj.customMetadata?.expires)) error(404, 'Nothing here.');
	const lines = parseLines(await obj.json());
	if (!lines) error(404, 'Nothing here.');
	return { id, lines, expires: obj.customMetadata!.expires };
}

export function parseLines(input: unknown): ShareLine[] | null {
	if (!Array.isArray(input) || !input.length || input.length > MAX_LINES) return null;
	const out: ShareLine[] = [];
	for (const raw of input) {
		if (!raw || typeof raw !== 'object') return null;
		const l = raw as Record<string, unknown>;
		const speaker = l.speaker;
		const start = l.start;
		const end = l.end;
		const original = l.original;
		const text = l.text;
		if (
			typeof speaker !== 'number' ||
			!Number.isInteger(speaker) ||
			speaker < 0 ||
			typeof start !== 'number' ||
			typeof end !== 'number' ||
			!Number.isFinite(start) ||
			!Number.isFinite(end) ||
			start < 0 ||
			end < start ||
			typeof original !== 'string' ||
			typeof text !== 'string' ||
			original.length > MAX_TEXT ||
			text.length > MAX_TEXT
		)
			return null;
		out.push({ speaker, start, end, original, text });
	}
	return out;
}

const IMMUTABLE = 'public, max-age=604800, immutable';

export async function serveObject(
	bucket: R2Bucket,
	id: string,
	name: string,
	request: Request
): Promise<Response> {
	if (!isId(id)) error(404, 'Nothing here.');
	const key = `${id}/${name}`;
	const range = parseRange(request.headers.get('range'));
	let obj: R2ObjectBody | null;
	try {
		obj = await bucket.get(key, range ? { range } : undefined);
	} catch {
		obj = null;
	}
	if (!obj) {
		const head = await bucket.head(key);
		if (head && range && !isExpired(head.customMetadata?.expires)) {
			return new Response(null, {
				status: 416,
				headers: { 'content-range': `bytes */${head.size}` }
			});
		}
		error(404, 'Nothing here.');
	}
	if (isExpired(obj.customMetadata?.expires)) error(404, 'Nothing here.');

	const headers = new Headers({
		'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
		'cache-control': IMMUTABLE,
		'accept-ranges': 'bytes',
		etag: obj.httpEtag
	});
	if (!range) {
		headers.set('content-length', String(obj.size));
		return new Response(obj.body, { headers });
	}
	const { start, end } = bounds(range, obj.size);
	if (start >= obj.size || start > end) {
		return new Response(null, {
			status: 416,
			headers: { 'content-range': `bytes */${obj.size}` }
		});
	}
	headers.set('content-range', `bytes ${start}-${end}/${obj.size}`);
	headers.set('content-length', String(end - start + 1));
	return new Response(obj.body, { status: 206, headers });
}

type Range = { offset: number; length?: number } | { suffix: number };

export function parseRange(header: string | null): Range | null {
	const m = header?.match(/^bytes=(\d*)-(\d*)$/);
	if (!m || (!m[1] && !m[2])) return null;
	if (!m[1]) return { suffix: Number(m[2]) };
	const offset = Number(m[1]);
	if (!m[2]) return { offset };
	const last = Number(m[2]);
	if (last < offset) return null;
	return { offset, length: last - offset + 1 };
}

export function bounds(range: Range, size: number): { start: number; end: number } {
	if ('suffix' in range) {
		return { start: Math.max(0, size - range.suffix), end: size - 1 };
	}
	const end =
		range.length === undefined ? size - 1 : Math.min(size - 1, range.offset + range.length - 1);
	return { start: range.offset, end };
}
