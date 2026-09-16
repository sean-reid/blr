import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ensureWidget } from './turnstile-widget.mjs';

const ACCOUNT = 'acc123';
const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/challenges/widgets`;
const args = { token: 'tok', accountId: ACCOUNT, name: 'blr', domain: 'blr.dwainosaur.com' };

function fakeFetch(routes) {
	const calls = [];
	const fetch = async (url, init = {}) => {
		const method = init.method ?? 'GET';
		calls.push({ url, method, init });
		const handler = routes.find((r) => r.method === method && r.match(url));
		assert.ok(handler, `unexpected ${method} ${url}`);
		const { status = 200, body } = handler.respond(url, init);
		return {
			ok: status >= 200 && status < 300,
			status,
			statusText: String(status),
			json: async () => body
		};
	};
	return { fetch, calls };
}

const listing = (widgets) => ({
	method: 'GET',
	match: (u) => u.startsWith(`${BASE}?`),
	respond: () => ({
		body: { success: true, result: widgets, result_info: { total_count: widgets.length } }
	})
});

test('rotates the secret of an existing widget', async () => {
	const { fetch, calls } = fakeFetch([
		listing([
			{ sitekey: 'other', name: 'something-else' },
			{ sitekey: 'sk_blr', name: 'blr' }
		]),
		{
			method: 'POST',
			match: (u) => u === `${BASE}/sk_blr/rotate_secret`,
			respond: () => ({ body: { success: true, result: { sitekey: 'sk_blr', secret: 'new' } } })
		}
	]);
	const widget = await ensureWidget({ fetch, ...args });
	assert.deepEqual(widget, { sitekey: 'sk_blr', secret: 'new', created: false });
	const rotate = calls.find((c) => c.url.endsWith('/rotate_secret'));
	assert.deepEqual(JSON.parse(rotate.init.body), { invalidate_immediately: false });
	assert.equal(rotate.init.headers.authorization, 'Bearer tok');
});

test('keeps the stored secret when a rotation is already pending', async () => {
	const { fetch } = fakeFetch([
		listing([{ sitekey: 'sk_blr', name: 'blr' }]),
		{
			method: 'POST',
			match: (u) => u === `${BASE}/sk_blr/rotate_secret`,
			respond: () => ({
				status: 400,
				body: {
					success: false,
					errors: [{ message: 'A secret rotation is already in progress for this widget' }]
				}
			})
		}
	]);
	const widget = await ensureWidget({ fetch, ...args });
	assert.deepEqual(widget, { sitekey: 'sk_blr', secret: null, created: false });
});

test('creates the widget when none has the name', async () => {
	const { fetch, calls } = fakeFetch([
		listing([{ sitekey: 'other', name: 'something-else' }]),
		{
			method: 'POST',
			match: (u) => u === BASE,
			respond: () => ({ body: { success: true, result: { sitekey: 'sk_new', secret: 'fresh' } } })
		}
	]);
	const widget = await ensureWidget({ fetch, ...args });
	assert.deepEqual(widget, { sitekey: 'sk_new', secret: 'fresh', created: true });
	const create = calls.find((c) => c.method === 'POST');
	assert.deepEqual(JSON.parse(create.init.body), {
		name: 'blr',
		domains: ['blr.dwainosaur.com'],
		mode: 'invisible'
	});
	assert.equal(calls.filter((c) => c.url.includes('rotate_secret')).length, 0);
});

test('walks every page before deciding the widget is missing', async () => {
	const pages = [
		Array.from({ length: 100 }, (_, i) => ({ sitekey: `k${i}`, name: `w${i}` })),
		[{ sitekey: 'sk_blr', name: 'blr' }]
	];
	const { fetch, calls } = fakeFetch([
		{
			method: 'GET',
			match: (u) => u.startsWith(`${BASE}?`),
			respond: (u) => {
				const page = Number(new URL(u).searchParams.get('page'));
				return {
					body: { success: true, result: pages[page - 1], result_info: { total_count: 101 } }
				};
			}
		},
		{
			method: 'POST',
			match: (u) => u === `${BASE}/sk_blr/rotate_secret`,
			respond: () => ({ body: { success: true, result: { sitekey: 'sk_blr', secret: 's' } } })
		}
	]);
	const widget = await ensureWidget({ fetch, ...args });
	assert.equal(widget.created, false);
	assert.equal(calls.filter((c) => c.method === 'GET').length, 2);
});

test('surfaces the API error message', async () => {
	const { fetch } = fakeFetch([
		{
			method: 'GET',
			match: () => true,
			respond: () => ({
				status: 403,
				body: { success: false, errors: [{ code: 10000, message: 'Authentication error' }] }
			})
		}
	]);
	await assert.rejects(ensureWidget({ fetch, ...args }), /403 .*Authentication error/);
});

test('fails when the API answers with success false on a 200', async () => {
	const { fetch } = fakeFetch([
		listing([{ sitekey: 'sk_blr', name: 'blr' }]),
		{
			method: 'POST',
			match: (u) => u.endsWith('/rotate_secret'),
			respond: () => ({ body: { success: false, errors: [{ message: 'widget locked' }] } })
		}
	]);
	await assert.rejects(ensureWidget({ fetch, ...args }), /widget locked/);
});

test('the CLI masks both values and writes them to GITHUB_OUTPUT', async () => {
	const { execFile } = await import('node:child_process');
	const { promisify } = await import('node:util');
	const { mkdtempSync, readFileSync } = await import('node:fs');
	const { tmpdir } = await import('node:os');
	const { join } = await import('node:path');
	const out = join(mkdtempSync(join(tmpdir(), 'blr-')), 'output');
	const stub = `globalThis.fetch = async (url, init = {}) => ({
		ok: true, status: 200, statusText: 'OK',
		json: async () => (init.method === 'POST'
			? { success: true, result: { sitekey: 'sk_cli', secret: 'sec_cli' } }
			: { success: true, result: [{ sitekey: 'sk_cli', name: 'blr' }], result_info: { total_count: 1 } })
	});`;
	const { stdout } = await promisify(execFile)(
		process.execPath,
		[
			'--import',
			`data:text/javascript,${encodeURIComponent(stub)}`,
			'scripts/turnstile-widget.mjs'
		],
		{
			env: {
				...process.env,
				CLOUDFLARE_API_TOKEN: 'tok',
				CLOUDFLARE_ACCOUNT_ID: 'acc',
				GITHUB_OUTPUT: out
			}
		}
	);
	assert.match(stdout, /^::add-mask::sk_cli\n::add-mask::sec_cli\n/);
	assert.equal(readFileSync(out, 'utf8'), 'sitekey=sk_cli\nsecret=sec_cli\n');
});
