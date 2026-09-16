# Changelog

## [0.2.0](https://github.com/sean-reid/blr/compare/blr-v0.1.0...blr-v0.2.0) (2026-09-16)


### Features

* **voice:** fit readings to the mouth by measurement, not by counting ([#43](https://github.com/sean-reid/blr/issues/43)) ([a5fc3a3](https://github.com/sean-reid/blr/commit/a5fc3a34b7df17cbc2713edd981e3c340477b1a9))
* **voice:** write readings to the syllable count the mouth allows ([#42](https://github.com/sean-reid/blr/issues/42)) ([e808f60](https://github.com/sean-reid/blr/commit/e808f60e33a99898c2cf9c2474bf3da3bb35c021))


### Bug Fixes

* **server:** ride out KV write bursts and Workers AI hiccups ([#40](https://github.com/sean-reid/blr/issues/40)) ([75c55d9](https://github.com/sean-reid/blr/commit/75c55d986b5a6cae0f6eaf1888c70f981d3f63ec))
* **voice:** fit readings before they are shown, so Voice it speaks the text on screen ([#44](https://github.com/sean-reid/blr/issues/44)) ([f4e5374](https://github.com/sean-reid/blr/commit/f4e5374328f69ba5cd1afe41180aa92ba920b3f2))

## [0.1.0](https://github.com/sean-reid/blr/compare/blr-v0.0.1...blr-v0.1.0) (2026-09-16)


### Features

* **editor:** captions, sidecars, mute, rename and a clean toggle ([#31](https://github.com/sean-reid/blr/issues/31)) ([b140044](https://github.com/sean-reid/blr/commit/b1400449af7540b46618e9c9c533495ab85ecd26))
* **guards:** Turnstile, per-IP rate limit and a daily neuron ceiling ([#23](https://github.com/sean-reid/blr/issues/23)) ([b2140be](https://github.com/sean-reid/blr/commit/b2140bebb2d7a887cf37c738a04cad5378a30843))
* **meta:** Open Graph card, social tags and font preload ([#28](https://github.com/sean-reid/blr/issues/28)) ([d3ebb0b](https://github.com/sean-reid/blr/commit/d3ebb0b9c87ca2b25511e3d9a38e2769aac3345a))
* **render:** export the finished video as mp4 ([#14](https://github.com/sean-reid/blr/issues/14)) ([8c0df5f](https://github.com/sean-reid/blr/commit/8c0df5f3e1e8ac1f2bc9f6ec550ecbf76360bbc7))
* **rewrite:** phrase-level bad lip reading with ranked options ([#11](https://github.com/sean-reid/blr/issues/11)) ([3463459](https://github.com/sean-reid/blr/commit/3463459b9bdcfbb078b309c3867ff5b216168e82))
* **separate:** in-browser vocal separation with MDX-Net ([#12](https://github.com/sean-reid/blr/issues/12)) ([992cbce](https://github.com/sean-reid/blr/commit/992cbce1995a0d9c9035cc0f8ead9d51515fd97a))
* **separate:** separated instrumental as the bed, model served from R2 ([#25](https://github.com/sean-reid/blr/issues/25)) ([5fbc971](https://github.com/sean-reid/blr/commit/5fbc971908c9fb1f9ef761d86e7415c48cd39fd7))
* **share:** seven-day share links with a player page ([#22](https://github.com/sean-reid/blr/issues/22)) ([d044b27](https://github.com/sean-reid/blr/commit/d044b27baa34c657dfc108cec6b6ddf908e2c7f2))
* **transcribe:** transcription pipeline with speaker lines ([#10](https://github.com/sean-reid/blr/issues/10)) ([0c1467c](https://github.com/sean-reid/blr/commit/0c1467ca0c7fb04e8105f63be7f40d067f446379))
* **trim:** trim window for videos over three minutes ([#30](https://github.com/sean-reid/blr/issues/30)) ([fbe4ab0](https://github.com/sean-reid/blr/commit/fbe4ab069cb5dd53263b897633227ac72c79cc7c))
* **ui:** drop state with the editorial visual system ([7e5918b](https://github.com/sean-reid/blr/commit/7e5918b61992d8727f9166f7a562142c63c8026d))
* **viseme:** mouth-shape dictionary and candidate lookup ([#9](https://github.com/sean-reid/blr/issues/9)) ([24a5d85](https://github.com/sean-reid/blr/commit/24a5d8500bfadf8bd3b6d382bf91860aeabcedf1))
* **voice:** speak the new lines and preview the mix ([#13](https://github.com/sean-reid/blr/issues/13)) ([2d47ffd](https://github.com/sean-reid/blr/commit/2d47ffd03c6b9576707eeda90b587e63fe2704c2))


### Bug Fixes

* **app:** survive a deploy under an open tab ([#34](https://github.com/sean-reid/blr/issues/34)) ([b34b777](https://github.com/sean-reid/blr/commit/b34b777b8b80913de7152c562ce13fe27ddf366a))
* **deploy:** keep the Turnstile secret when a rotation is still pending ([#32](https://github.com/sean-reid/blr/issues/32)) ([0a2b629](https://github.com/sean-reid/blr/commit/0a2b6291acb1ad4d0f90eefe4236dd3e5a3e51b1))
* **guards:** raise the per-IP rate limit to 150 requests a minute ([#38](https://github.com/sean-reid/blr/issues/38)) ([2e0c9bb](https://github.com/sean-reid/blr/commit/2e0c9bb7725b74fc1c612cc425b6e90cb02259f1))
* **transcript:** fold short speaker slips into the neighbouring line ([#21](https://github.com/sean-reid/blr/issues/21)) ([b08118a](https://github.com/sean-reid/blr/commit/b08118ac93a5ec3ab11dc1217e84d0d9cd9337ab))
* **types:** keep svelte-check off the build output ([#20](https://github.com/sean-reid/blr/issues/20)) ([d5c2c1f](https://github.com/sean-reid/blr/commit/d5c2c1f82859133ab5a4925b67fb73f90274d904)), closes [#15](https://github.com/sean-reid/blr/issues/15)
* **voice:** align speech by runs between pauses instead of word by word ([#36](https://github.com/sean-reid/blr/issues/36)) ([b20dff0](https://github.com/sean-reid/blr/commit/b20dff0dc40a66e2c1a230ee5b3ac504d8c78379))
* **voice:** line every spoken word up with the mouth movement it belongs to ([#33](https://github.com/sean-reid/blr/issues/33)) ([32d5c38](https://github.com/sean-reid/blr/commit/32d5c38197f6b817b13df116ccb57aa41154535b))
* **voice:** speak exactly the readings on screen, once each ([#39](https://github.com/sean-reid/blr/issues/39)) ([37c0246](https://github.com/sean-reid/blr/commit/37c0246618d5834091d2bdd354de8332a8249c60))


### Security

* **share:** require the session token to upload a share ([#26](https://github.com/sean-reid/blr/issues/26)) ([e42eb88](https://github.com/sean-reid/blr/commit/e42eb88ac75a5a3d24d476178d92060f95df440c))


### Performance

* **media:** load mediabunny and the separator only when they are used ([#27](https://github.com/sean-reid/blr/issues/27)) ([45db35d](https://github.com/sean-reid/blr/commit/45db35d891ed34eafb450e261e902c100beea89d))
* **voice:** rank readings by predicted spoken length before speaking ([#35](https://github.com/sean-reid/blr/issues/35)) ([a30d870](https://github.com/sean-reid/blr/commit/a30d870664f10ffb233bc086cc3e41fa87feb460))
