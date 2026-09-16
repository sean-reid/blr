import type { PageServerLoad } from './$types';
import { loadShare, shareBucket } from '$lib/server/share';

export const load: PageServerLoad = async ({ params, platform, setHeaders }) => {
	const share = await loadShare(shareBucket(platform), params.id);
	setHeaders({ 'cache-control': 'public, max-age=300' });
	return share;
};
