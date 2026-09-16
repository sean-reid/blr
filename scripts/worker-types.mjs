// Generates Worker env types. The mainModule declaration would otherwise
// point svelte-check at the build output whenever one exists locally.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const out = 'src/worker-configuration.d.ts';
execFileSync('wrangler', ['types', out], { stdio: 'inherit' });
const text = readFileSync(out, 'utf8').replace(
	/mainModule: typeof import\([^)]*\);/,
	'mainModule: string;'
);
writeFileSync(out, text);
