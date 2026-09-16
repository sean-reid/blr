import type { RequestHandler } from './$types';
import { serveObject, shareBucket } from '$lib/server/share';

export const GET: RequestHandler = ({ params, platform, request }) =>
	serveObject(shareBucket(platform), params.id, 'video.mp4', request);
