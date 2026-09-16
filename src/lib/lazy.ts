export const STALE_MESSAGE =
	'BLR was updated while this page was open. Reload the page and try again.';

const IMPORT_FAILURE = /import|module script|dynamically imported|Loading chunk|Failed to fetch/i;

// A deploy replaces the hashed chunks a long-lived tab still points at, so a
// failed dynamic import gets a message a person can act on.
export async function lazy<T>(load: () => Promise<T>): Promise<T> {
	try {
		return await load();
	} catch (e) {
		if (e instanceof Error && IMPORT_FAILURE.test(e.message))
			throw new Error(STALE_MESSAGE, { cause: e });
		throw e;
	}
}
