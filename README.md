# BLR

Bad lip reading generator. Drop a video of people talking and get it back with the speech replaced by lines that make the same mouth shapes, spoken by a different voice per speaker over the original background sound.

The video never leaves your browser. Audio is extracted locally, sent for transcription, and the new audio is mixed and muxed back in on your machine. Vocal separation runs in the browser too.

Live at [blr.dwainosaur.com](https://blr.dwainosaur.com).

## Develop

```sh
pnpm install
pnpm dev
```

AI calls are mocked in development and tests. Dev and preview load bindings from `wrangler.dev.jsonc`, which has no AI binding and sets `AI_MODE=mock`; the mock answers every transcription with a recorded response for the sample clip. Set `BLR_LIVE=1` to develop against `wrangler.jsonc` and real Workers AI, which costs money. End-to-end tests run in Google Chrome, which Playwright installs on demand.

## Test

```sh
pnpm lint
pnpm check
pnpm test:unit --run
pnpm test:e2e
```

## Deploy

```sh
pnpm build
pnpm exec wrangler deploy
```
