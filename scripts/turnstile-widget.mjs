// Finds or creates the production Turnstile widget and hands the deploy a
// fresh secret. Run with CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID set.
import { appendFileSync } from 'node:fs';

const API = 'https://api.cloudflare.com/client/v4';
const PER_PAGE = 100;

async function call(fetch, token, path, init = {}) {
	const res = await fetch(`${API}${path}`, {
		...init,
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/json',
			...init.headers
		}
	});
	let body;
	try {
		body = await res.json();
	} catch {
		throw new Error(`Cloudflare API ${res.status} on ${path}: no JSON body`);
	}
	if (!res.ok || !body.success) {
		const detail = (body.errors ?? []).map((e) => e.message).join('; ') || res.statusText;
		throw new Error(`Cloudflare API ${res.status} on ${path}: ${detail}`);
	}
	return body;
}

async function findWidget(fetch, token, accountId, name) {
	for (let page = 1; ; page++) {
		const { result, result_info: info } = await call(
			fetch,
			token,
			`/accounts/${accountId}/challenges/widgets?page=${page}&per_page=${PER_PAGE}`
		);
		const hit = result.find((w) => w.name === name);
		if (hit) return hit;
		if (result.length < PER_PAGE || page * PER_PAGE >= (info?.total_count ?? 0)) return null;
	}
}

export async function ensureWidget({ fetch, token, accountId, name, domain }) {
	const found = await findWidget(fetch, token, accountId, name);
	if (!found) {
		const { result } = await call(fetch, token, `/accounts/${accountId}/challenges/widgets`, {
			method: 'POST',
			body: JSON.stringify({ name, domains: [domain], mode: 'invisible' })
		});
		return { sitekey: result.sitekey, secret: result.secret, created: true };
	}
	const { result } = await call(
		fetch,
		token,
		`/accounts/${accountId}/challenges/widgets/${found.sitekey}/rotate_secret`,
		{ method: 'POST', body: JSON.stringify({ invalidate_immediately: false }) }
	);
	return { sitekey: result.sitekey, secret: result.secret, created: false };
}

function required(key) {
	const value = process.env[key];
	if (!value) throw new Error(`${key} is not set`);
	return value;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
	const widget = await ensureWidget({
		fetch,
		token: required('CLOUDFLARE_API_TOKEN'),
		accountId: required('CLOUDFLARE_ACCOUNT_ID'),
		name: process.env.TURNSTILE_WIDGET_NAME ?? 'blr',
		domain: process.env.TURNSTILE_DOMAIN ?? 'blr.dwainosaur.com'
	});
	const out = process.env.GITHUB_OUTPUT;
	if (out) {
		console.log(`::add-mask::${widget.sitekey}`);
		console.log(`::add-mask::${widget.secret}`);
		appendFileSync(out, `sitekey=${widget.sitekey}\nsecret=${widget.secret}\n`);
		console.log(`Turnstile widget ${widget.created ? 'created' : 'found'}; secret rotated.`);
	} else {
		console.log(JSON.stringify(widget, null, 2));
	}
}
