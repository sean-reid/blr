import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { expiresAt } from '$lib/share/expiry';
import { newId } from '$lib/share/id';
import type { ShareResult } from '$lib/share/types';
import { rateLimit, requireToken } from '$lib/server/guard';
import { parseLines, shareBucket } from '$lib/server/share';

const MAX_VIDEO = 200 * 1024 * 1024;
const MAX_POSTER = 500 * 1024;
const MAX_TRANSCRIPT = 256 * 1024;

export const PUT: RequestHandler = async ({ request, platform, url }) => {
	const bucket = shareBucket(platform);
	await rateLimit(request, platform?.env.RATE);
	await requireToken(request, platform?.env.TOKEN_SECRET);
	const type = request.headers.get('content-type')?.split(';')[0].trim() ?? '';
	if (type !== 'multipart/form-data') error(415, 'Send the share as multipart form data.');
	const length = Number(request.headers.get('content-length') ?? 0);
	if (length > MAX_VIDEO + MAX_POSTER + MAX_TRANSCRIPT) error(413, 'The video is too large.');

	const form = await request.formData().catch(() => null);
	if (!form) error(400, 'The upload could not be read.');
	const video = form.get('video');
	const poster = form.get('poster');
	const transcript = form.get('transcript');
	if (!(video instanceof File) || video.type !== 'video/mp4')
		error(415, 'The video must be an MP4.');
	if (video.size > MAX_VIDEO) error(413, 'The video is too large.');
	if (!(poster instanceof File) || poster.type !== 'image/jpeg')
		error(415, 'The poster must be a JPEG.');
	if (poster.size > MAX_POSTER) error(413, 'The poster is too large.');
	const rawLines =
		typeof transcript === 'string'
			? transcript
			: transcript instanceof File && transcript.type === 'application/json'
				? await transcript.text()
				: '';
	if (rawLines.length > MAX_TRANSCRIPT) error(413, 'The transcript is too large.');
	let parsed: unknown;
	try {
		parsed = JSON.parse(rawLines);
	} catch {
		error(400, 'The transcript is not valid JSON.');
	}
	const lines = parseLines(parsed);
	if (!lines) error(400, 'The transcript has the wrong shape.');

	const id = newId();
	const expires = expiresAt();
	const customMetadata = { expires };
	await Promise.all([
		bucket.put(`${id}/video.mp4`, video, {
			httpMetadata: { contentType: 'video/mp4' },
			customMetadata
		}),
		bucket.put(`${id}/poster.jpg`, poster, {
			httpMetadata: { contentType: 'image/jpeg' },
			customMetadata
		}),
		bucket.put(`${id}/transcript.json`, JSON.stringify(lines), {
			httpMetadata: { contentType: 'application/json' },
			customMetadata
		})
	]);
	const result: ShareResult = { id, url: `${url.origin}/s/${id}`, expires };
	return json(result, { status: 201 });
};
