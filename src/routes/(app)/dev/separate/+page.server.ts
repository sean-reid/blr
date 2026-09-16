import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ platform }) => {
	const env = platform?.env as (Env & { DEV_PAGES?: string }) | undefined;
	if (!env?.DEV_PAGES) error(404, 'Not found.');
	return {};
};
