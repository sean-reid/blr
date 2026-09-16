declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
	}

	interface Env {
		TURNSTILE_SECRET?: string;
		TOKEN_SECRET?: string;
	}
}

export {};
