const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const FAILED = 'Browser check failed. Reload and try again.';
const REFRESH_MARGIN = 30_000;

interface Turnstile {
	render(
		host: HTMLElement,
		options: {
			sitekey: string;
			appearance: 'interaction-only';
			callback: (response: string) => void;
			'error-callback': () => void;
		}
	): string | undefined;
	reset(widget: string): void;
}

declare global {
	interface Window {
		turnstile?: Turnstile;
		onTurnstileReady?: () => void;
	}
}

let loading: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
	if (window.turnstile) return Promise.resolve(window.turnstile);
	loading ??= new Promise((resolve, reject) => {
		window.onTurnstileReady = () => resolve(window.turnstile!);
		const script = document.createElement('script');
		script.src = `${SCRIPT}&onload=onTurnstileReady`;
		script.async = true;
		script.onerror = () => {
			loading = null;
			reject(new Error(FAILED));
		};
		document.head.appendChild(script);
	});
	return loading;
}

interface Waiter {
	resolve: (response: string) => void;
	reject: (e: Error) => void;
}

/** Holds one signed token per tab and adds it to every API call, refreshing it once on a 401. */
export class Session {
	private token: { value: string; expires: number } | null = null;
	private pending: Promise<string> | null = null;
	private widget: string | null = null;
	private waiter: Waiter | null = null;

	constructor(
		private siteKey: () => string,
		private host: () => HTMLElement | null
	) {}

	fetch: typeof fetch = async (input, init) => {
		let res = await this.send(input, init, await this.bearer());
		if (res.status === 401) res = await this.send(input, init, await this.bearer(true));
		return res;
	};

	/** The Authorization header value; `fresh` drops the cached token first. */
	async bearer(fresh = false): Promise<string> {
		if (fresh) this.token = null;
		return `Bearer ${await this.get()}`;
	}

	private send(input: RequestInfo | URL, init: RequestInit | undefined, authorization: string) {
		const headers = new Headers(init?.headers);
		headers.set('authorization', authorization);
		return fetch(input, { ...init, headers });
	}

	private get(): Promise<string> {
		if (this.token && this.token.expires - Date.now() > REFRESH_MARGIN)
			return Promise.resolve(this.token.value);
		this.pending ??= this.issue().finally(() => (this.pending = null));
		return this.pending;
	}

	private async issue(): Promise<string> {
		const response = await this.challenge();
		const res = await fetch('/api/token', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ response })
		});
		if (!res.ok) {
			const body = (await res.json().catch(() => null)) as { message?: string } | null;
			throw new Error(body?.message ?? FAILED);
		}
		const { token, expires } = (await res.json()) as { token: string; expires: number };
		this.token = { value: token, expires };
		return token;
	}

	private async challenge(): Promise<string> {
		const sitekey = this.siteKey();
		if (!sitekey) throw new Error('Browser check is unavailable. Try again later.');
		const host = this.host();
		if (!host) throw new Error(FAILED);
		const turnstile = await loadTurnstile();
		return new Promise<string>((resolve, reject) => {
			this.waiter = { resolve, reject };
			if (this.widget) {
				turnstile.reset(this.widget);
				return;
			}
			this.widget =
				turnstile.render(host, {
					sitekey,
					appearance: 'interaction-only',
					callback: (response) => this.waiter?.resolve(response),
					'error-callback': () => this.waiter?.reject(new Error(FAILED))
				}) ?? null;
			if (!this.widget) reject(new Error(FAILED));
		});
	}
}
