# BLR

Bad lip reading generator. Drop a video of people talking and get it back with the speech replaced by lines that make the same mouth shapes, spoken by a different voice per speaker over the original background sound.

The video never leaves your browser. Audio is extracted locally, sent for transcription, and the new audio is mixed and muxed back in on your machine. Vocal separation runs in the browser too.

Live at [blr.dwainosaur.com](https://blr.dwainosaur.com).

## Develop

```sh
pnpm install
pnpm dev
```

AI calls are mocked in development unless `AI_MODE=live` is set. See `wrangler.jsonc` for the bindings a live deploy needs.

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
