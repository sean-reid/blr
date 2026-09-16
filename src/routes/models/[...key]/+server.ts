import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const KEY = /^[a-z0-9][a-z0-9._/-]{0,120}$/;

interface EdgeCache {
	match(key: Request): Promise<Response | undefined>;
	put(key: Request, response: Response): Promise<void>;
}

// Model and runtime files are immutable and large; the edge cache takes the
// repeat hits so R2 sees one read per region.
export const GET: RequestHandler = async ({ params, platform, request }) => {
	const key = params.key;
	if (!KEY.test(key) || key.includes('..')) error(404, 'Not found.');
	const bucket = platform?.env?.MODELS;
	if (!bucket) error(404, 'Not found.');

	const cache = platform?.caches?.default as unknown as EdgeCache | undefined;
	const cacheKey = new Request(new URL(request.url), { method: 'GET' });
	const range = request.headers.get('range');
	if (!range && cache) {
		const hit = await cache.match(cacheKey);
		if (hit) return hit;
	}

	const object = await bucket.get(key, range ? { range: request.headers } : undefined);
	if (!object) error(404, 'Not found.');

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set('etag', object.httpEtag);
	headers.set('cache-control', 'public, max-age=31536000, immutable');
	headers.set('cross-origin-resource-policy', 'same-origin');
	headers.set('accept-ranges', 'bytes');
	if (!headers.has('content-type')) headers.set('content-type', 'application/octet-stream');

	if (range && object.range && 'offset' in object.range) {
		const offset = object.range.offset ?? 0;
		const length = object.range.length ?? object.size - offset;
		headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
		headers.set('content-length', String(length));
		return new Response(object.body, { status: 206, headers });
	}

	headers.set('content-length', String(object.size));
	const response = new Response(object.body, { status: 200, headers });
	if (cache) platform?.ctx?.waitUntil(cache.put(cacheKey, response.clone()));
	return response;
};
