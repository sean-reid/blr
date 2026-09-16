declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
		}
	}

	interface Env {
		TURNSTILE_SECRET?: string;
		TOKEN_SECRET?: string;
	}
}

export {};
