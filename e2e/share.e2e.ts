import { expect, test } from './test';
import { readFileSync } from 'node:fs';
import { bearer } from './session';

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
const UNVERIFIED = 'Verification failed. Reload and try again.';

test('share uploads the mix and the link plays it back with captions', async ({
	page,
	context,
	request,
	baseURL
}) => {
	test.setTimeout(240_000);
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/');
	await page.getByRole('button', { name: 'or try a sample' }).click();
	await expect(page.locator('.lines li .new').first()).toBeVisible({ timeout: 30_000 });
	await page.getByRole('button', { name: 'Voice it' }).click();
	await expect(page.getByRole('button', { name: 'Share' })).toBeVisible({ timeout: 60_000 });
	const newLines = (await page.locator('.lines li .new').allInnerTexts()).map(tidy);
	const originals = (await page.locator('.lines li .original span:last-child').allInnerTexts()).map(
		tidy
	);

	const uploads: (string | undefined)[] = [];
	page.on('request', (r) => {
		if (r.url().endsWith('/api/share')) uploads.push(r.headers()['authorization']);
	});
	await page.getByRole('button', { name: 'Share' }).click();
	await expect(page.getByRole('status')).toContainText(/Exporting|Sharing/, { timeout: 30_000 });
	const link = page.locator('.link a');
	await expect(link).toBeVisible({ timeout: 120_000 });
	expect(uploads).toHaveLength(1);
	expect(uploads[0]).toMatch(/^Bearer \d+\.[\w-]+$/);
	await expect(page.getByText('Expires in 7 days')).toBeVisible();
	const href = new URL((await link.getAttribute('href'))!, baseURL).toString();
	expect(href).toMatch(/\/s\/[23456789a-hj-km-np-z]{10}$/);
	await expect(link).toHaveText(href.replace(/^https?:\/\//, ''));
	await page.screenshot({ path: 'test-results/share-link.png', fullPage: true });

	await page.getByRole('button', { name: 'Copy' }).click();
	await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(href);
	await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible({ timeout: 4000 });

	await page.goto(href);
	await expect(page).toHaveTitle('Bad lip reading');
	await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex');
	await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'video.other');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
		'content',
		`${href}/poster.jpg`
	);
	await expect(page.locator('meta[property="og:video"]')).toHaveAttribute(
		'content',
		`${href}/video.mp4`
	);
	await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
		'content',
		`${newLines[0]} ${newLines[1]}`
	);

	const video = page.locator('video');
	await expect(video).toBeVisible();
	await expect(video).toHaveAttribute('poster', `${href}/poster.jpg`);
	await expect(video).toHaveAttribute('src', `${href}/video.mp4`);
	const track = page.locator('video track[kind=captions][default]');
	await expect(track).toHaveAttribute('src', `${href}/captions.vtt`);
	await expect
		.poll(() => track.evaluate((t: HTMLTrackElement) => t.readyState), { timeout: 15_000 })
		.toBe(2);
	expect(
		await track.evaluate((t: HTMLTrackElement) => ({
			mode: t.track.mode,
			cues: t.track.cues?.length ?? 0
		}))
	).toEqual({ mode: 'showing', cues: newLines.length });
	await expect
		.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15_000 })
		.toBeGreaterThanOrEqual(1);

	const rows = page.locator('.lines li');
	await expect(rows).toHaveCount(newLines.length);
	expect((await rows.locator('.new').allInnerTexts()).map(tidy)).toEqual(newLines);
	expect((await rows.locator('.original span:last-child').allInnerTexts()).map(tidy)).toEqual(
		originals
	);
	await expect(rows.first().locator('.speaker')).toHaveText('A');
	await expect(page.getByText(/^Expires \d{1,2} [A-Z][a-z]{2} \d{4}$/)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Make your own' })).toHaveAttribute('href', '/');
	await page.screenshot({ path: 'test-results/share-desktop.png', fullPage: true });
	await page.setViewportSize({ width: 375, height: 740 });
	await page.screenshot({ path: 'test-results/share-mobile.png', fullPage: true });

	const vtt = await request.get(`${href}/captions.vtt`);
	expect(vtt.status()).toBe(200);
	expect(vtt.headers()['content-type']).toBe('text/vtt; charset=utf-8');
	const body = await vtt.text();
	expect(body.startsWith('WEBVTT\n\n1\n')).toBe(true);
	expect(body).toContain(`<v Speaker A>${newLines[0]}`);
	expect(body.match(/-->/g)?.length).toBe(newLines.length);

	const poster = await request.get(`${href}/poster.jpg`);
	expect(poster.status()).toBe(200);
	expect(poster.headers()['content-type']).toBe('image/jpeg');
	expect(poster.headers()['cache-control']).toContain('immutable');
	const bytes = await poster.body();
	expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
	const width = await page.evaluate(
		(src) =>
			new Promise<number>((resolve, reject) => {
				const img = new Image();
				img.onload = () => resolve(img.naturalWidth);
				img.onerror = () => reject(new Error('poster did not decode'));
				img.src = src;
			}),
		`${href}/poster.jpg`
	);
	expect(width).toBeGreaterThan(0);
	expect(width).toBeLessThanOrEqual(1280);

	const full = await request.get(`${href}/video.mp4`);
	expect(full.status()).toBe(200);
	expect(full.headers()['content-type']).toBe('video/mp4');
	expect(full.headers()['accept-ranges']).toBe('bytes');
	const size = Number(full.headers()['content-length']);
	const part = await request.get(`${href}/video.mp4`, { headers: { range: 'bytes=100-199' } });
	expect(part.status()).toBe(206);
	expect(part.headers()['content-range']).toBe(`bytes 100-199/${size}`);
	expect((await part.body()).length).toBe(100);
	const tail = await request.get(`${href}/video.mp4`, { headers: { range: 'bytes=-10' } });
	expect(tail.status()).toBe(206);
	expect(tail.headers()['content-range']).toBe(`bytes ${size - 10}-${size - 1}/${size}`);
	const beyond = await request.get(`${href}/video.mp4`, {
		headers: { range: `bytes=${size + 5}-` }
	});
	expect(beyond.status()).toBe(416);
});

test('an unknown id is a plain 404', async ({ page, request }) => {
	const res = await page.goto('/s/abcdefghjk');
	expect(res?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'Nothing here.' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Make your own' })).toHaveAttribute('href', '/');
	await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex');
	await page.screenshot({ path: 'test-results/share-404.png', fullPage: true });
	for (const path of ['/s/abcdefghjk/video.mp4', '/s/abcdefghjk/poster.jpg', '/s/x/captions.vtt']) {
		expect((await request.get(path)).status()).toBe(404);
	}
});

test('the share route needs a session token', async ({ request, baseURL }) => {
	const origin = { origin: baseURL! };
	const anonymous = await request.put('/api/share', {
		headers: origin,
		multipart: { transcript: '[]' }
	});
	expect(anonymous.status()).toBe(401);
	expect((await anonymous.json()).message).toBe(UNVERIFIED);

	const forged = await request.put('/api/share', {
		headers: { ...origin, authorization: 'Bearer 9999999999999.forged' },
		multipart: { transcript: '[]' }
	});
	expect(forged.status()).toBe(401);
	expect((await forged.json()).message).toBe(UNVERIFIED);
});

test('the share route rejects bad uploads with a reason', async ({ request, baseURL }) => {
	const poster = readFileSync('static/favicon.svg');
	const headers = { origin: baseURL!, ...(await bearer(request)) };
	const plain = await request.put('/api/share', { headers, data: { hi: 1 } });
	expect(plain.status()).toBe(415);
	expect((await plain.json()).message).toBe('Send the share as multipart form data.');

	const crossSite = await request.put('/api/share', {
		multipart: { transcript: '[]' }
	});
	expect(crossSite.status()).toBe(403);

	const wrongVideo = await request.put('/api/share', {
		headers,
		multipart: {
			video: { name: 'v.webm', mimeType: 'video/webm', buffer: Buffer.from('abc') },
			poster: { name: 'p.jpg', mimeType: 'image/jpeg', buffer: poster },
			transcript: JSON.stringify([])
		}
	});
	expect(wrongVideo.status()).toBe(415);
	expect((await wrongVideo.json()).message).toBe('The video must be an MP4.');

	const badTranscript = await request.put('/api/share', {
		headers,
		multipart: {
			video: { name: 'v.mp4', mimeType: 'video/mp4', buffer: Buffer.from('abc') },
			poster: { name: 'p.jpg', mimeType: 'image/jpeg', buffer: poster },
			transcript: JSON.stringify([{ speaker: 'A' }])
		}
	});
	expect(badTranscript.status()).toBe(400);
	expect((await badTranscript.json()).message).toBe('The transcript has the wrong shape.');

	const bigPoster = await request.put('/api/share', {
		headers,
		multipart: {
			video: { name: 'v.mp4', mimeType: 'video/mp4', buffer: Buffer.from('abc') },
			poster: { name: 'p.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(600 * 1024) },
			transcript: JSON.stringify([])
		}
	});
	expect(bigPoster.status()).toBe(413);
	expect((await bigPoster.json()).message).toBe('The poster is too large.');
});
