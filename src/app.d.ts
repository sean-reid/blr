declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
		}
	}
}

export {};
