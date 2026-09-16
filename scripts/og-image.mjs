// Renders static/og.png (1200 x 630) from the site's own type and colours.
// Run: node scripts/og-image.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const font = readFileSync('src/lib/assets/fonts/instrument-sans-latin.woff2').toString('base64');
const html = `<!doctype html><html><head><style>
@font-face{font-family:IS;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400 700}
html,body{margin:0;width:1200px;height:630px;background:#f5f1ea;color:#14120f;font-family:IS,system-ui,sans-serif}
.card{position:relative;width:1200px;height:630px;box-sizing:border-box;padding:96px 104px}
.mark{font-weight:700;font-size:56px;letter-spacing:-0.02em}
.line{margin-top:28px;font-size:72px;letter-spacing:-0.02em;line-height:1.05;max-width:900px}
.sub{position:absolute;left:104px;bottom:96px;font-size:30px;color:rgb(20 18 15 / 55%)}
.bar{position:absolute;left:0;top:0;width:1200px;height:8px;background:#d3401f}
.mouth{position:absolute;right:104px;bottom:88px;width:160px;height:160px}
</style></head><body><div class="card"><div class="bar"></div>
<div class="mark">BLR</div>
<div class="line">Bad lip reading, from any video, in your browser.</div>
<div class="sub">blr.dwainosaur.com</div>
<svg class="mouth" viewBox="0 0 64 64"><path d="M3 32 C 15 14, 25 19, 32 21 C 39 19, 49 14, 61 32 C 49 50, 39 52, 32 50 C 25 52, 15 50, 3 32 Z" fill="#14120f"/><path d="M10 32 C 20 26, 27 27, 32 28 C 37 27, 44 26, 54 32 C 44 41, 37 42, 32 41 C 27 42, 20 41, 10 32 Z" fill="#d3401f"/></svg>
</div></body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'static/og.png', type: 'png' });
await browser.close();
console.log('wrote static/og.png');
