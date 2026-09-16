import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ platform }) => {
	return { siteKey: platform?.env.TURNSTILE_SITE_KEY ?? '' };
};
