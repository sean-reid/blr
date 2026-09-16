import type { Handle, HandleServerError } from '@sveltejs/kit';

/** Cross-origin isolation lets the separation worker use SharedArrayBuffer for WASM threads. */
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event, {
		preload: ({ type, path }) =>
			type === 'js' || type === 'css' || (type === 'font' && !path.includes('italic'))
	});
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	return response;
};

export const handleError: HandleServerError = ({ error, status }) => {
	if (status !== 500) return;
	console.error(error);
	return { message: 'Something failed on the server. Try again.' };
};
