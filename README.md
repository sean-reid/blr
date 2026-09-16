# BLR

Bad lip reading generator. Drop a video of people talking and get it back with the speech replaced by lines that make the same mouth shapes, spoken by a different voice per speaker over the original background sound.

The video never leaves your browser. Audio is extracted locally, sent for transcription, and the new audio is mixed and muxed back in on your machine. Vocal separation runs in the browser too.

Share uploads the finished video to a link that plays it with captions and expires after seven days. Nothing is stored unless you share.

Live at [blr.dwainosaur.com](https://blr.dwainosaur.com).

## Develop

```sh
pnpm install
pnpm dev
```

AI calls are mocked in development and tests. Dev and preview load bindings from `wrangler.dev.jsonc`, which has no AI binding, sets `AI_MODE=mock` and uses Turnstile's test keys so the browser check always passes; the mock answers every transcription with a recorded response for the sample clip. Set `BLR_LIVE=1` to develop against `wrangler.jsonc` and real Workers AI, which costs money. Shares go to the `blr-share` R2 bucket, which the local proxy emulates on disk, so sharing works offline. End-to-end tests run in Google Chrome, which Playwright installs on demand.

## Test

```sh
pnpm lint
pnpm check
pnpm test:unit --run
pnpm test:e2e
```

## Deploy

Every push to `main` that passes CI deploys to [blr.dwainosaur.com](https://blr.dwainosaur.com) through `.github/workflows/deploy.yml`, which can also be run by hand from the Actions tab. The workflow builds, finds or creates the `blr` Turnstile widget and rotates its secret, deploys the Worker with the widget's site key, sets `TURNSTILE_SECRET` and a fresh random `TOKEN_SECRET` (session tokens live fifteen minutes, so a new signing key per deploy costs nothing), then checks that the home page and `/sample.mp4` respond.

The repo needs a `CLOUDFLARE_API_TOKEN` Actions secret with Workers Scripts, Workers AI, Workers KV Storage, Workers R2 Storage and Turnstile write access plus Account Settings read on the account, and Workers Routes and DNS write on the `dwainosaur.com` zone. A `CLOUDFLARE_ACCOUNT_ID` Actions variable overrides the account id baked into the workflow. The R2 buckets and KV namespace named in `wrangler.jsonc` must exist before the first deploy.

Every AI route sits behind an invisible Turnstile challenge, a per-IP rate limit and a daily Workers AI ceiling; `DAILY_NEURONS` in `wrangler.jsonc` caps spend per UTC day. To deploy from a machine that is logged in to Wrangler, run `pnpm build && pnpm exec wrangler deploy` and set the two secrets with `wrangler secret put`.
