import type { ShareLine, ShareResult } from './types';

const POSTER_WIDTH = 1280;
const POSTER_QUALITY = 0.8;

export async function posterFrame(src: string, time: number): Promise<Blob> {
	const video = document.createElement('video');
	video.muted = true;
	video.playsInline = true;
	video.preload = 'auto';
	video.src = src;
	await once(video, 'loadeddata', 'Could not read the video for a poster.');
	video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
	await once(video, 'seeked', 'Could not seek the video for a poster.');
	const scale = Math.min(1, POSTER_WIDTH / video.videoWidth);
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(video.videoWidth * scale);
	canvas.height = Math.round(video.videoHeight * scale);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not draw the poster.');
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
	video.removeAttribute('src');
	video.load();
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the poster.'))),
			'image/jpeg',
			POSTER_QUALITY
		);
	});
}

function once(video: HTMLVideoElement, event: string, message: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const done = () => {
			cleanup();
			resolve();
		};
		const fail = () => {
			cleanup();
			reject(new Error(message));
		};
		const cleanup = () => {
			video.removeEventListener(event, done);
			video.removeEventListener('error', fail);
		};
		video.addEventListener(event, done);
		video.addEventListener('error', fail);
	});
}

export async function uploadShare(
	video: Blob,
	poster: Blob,
	lines: ShareLine[],
	onProgress: (fraction: number) => void,
	bearer: (fresh?: boolean) => Promise<string>
): Promise<ShareResult> {
	const form = new FormData();
	form.append('video', video, 'video.mp4');
	form.append('poster', poster, 'poster.jpg');
	form.append(
		'transcript',
		new Blob([JSON.stringify(lines)], { type: 'application/json' }),
		'transcript.json'
	);
	let res = await send(form, await bearer(), onProgress);
	if (res.status === 401) res = await send(form, await bearer(true), onProgress);
	const body = res.body as { message?: string } | ShareResult | null;
	if (res.status >= 200 && res.status < 300 && body && 'id' in body) return body;
	throw new Error((body as { message?: string } | null)?.message ?? res.statusText);
}

function send(
	form: FormData,
	authorization: string,
	onProgress: (fraction: number) => void
): Promise<{ status: number; statusText: string; body: unknown }> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', '/api/share');
		xhr.setRequestHeader('authorization', authorization);
		xhr.responseType = 'json';
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress(e.loaded / e.total);
		};
		xhr.onerror = () => reject(new Error('The upload failed.'));
		xhr.onload = () =>
			resolve({ status: xhr.status, statusText: xhr.statusText, body: xhr.response });
		xhr.send(form);
	});
}
