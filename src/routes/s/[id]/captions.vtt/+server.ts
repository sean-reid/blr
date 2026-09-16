import type { RequestHandler } from './$types';
import { loadShare, shareBucket } from '$lib/server/share';
import { toVtt } from '$lib/share/vtt';

export const GET: RequestHandler = async ({ params, platform }) => {
	const share = await loadShare(shareBucket(platform), params.id);
	return new Response(toVtt(share.lines), {
		headers: {
			'content-type': 'text/vtt; charset=utf-8',
			'cache-control': 'public, max-age=604800, immutable'
		}
	});
};
