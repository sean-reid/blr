import type { RequestHandler } from './$types';
import { serveObject, shareBucket } from '$lib/server/share';

export const GET: RequestHandler = ({ params, platform, request }) =>
	serveObject(shareBucket(platform), params.id, 'poster.jpg', request);
