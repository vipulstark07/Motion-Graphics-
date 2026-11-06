// Renders preview stills of dist/kitchen.glb through viewer/index.html.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { serve } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT || path.join(ROOT, 'previews');
const views = (process.argv[2] || 'hero').split(',');
const scale = Number(process.env.DPR || 1);
fs.mkdirSync(OUT, { recursive: true });
const { srv, port } = await serve(ROOT);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const v of views) {
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: scale });
await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (route) => {
  const p = new URL(route.request().url()).pathname.replace('/npm/three@0.170.0/', '');
  route.fulfill({ path: path.join(ROOT, 'node_modules/three', p), contentType: 'text/javascript' });
});
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/viewer/index.html?still=1&view=${v}${process.env.MODEL ? '&model=' + process.env.MODEL : ''}`);
  await page.waitForFunction(() => window.__rendered, null, { timeout: 120000 });
  await page.screenshot({ path: path.join(OUT, `${v}.png`), timeout: 180000 });
  console.log('rendered', v);
  await page.close();
}
await browser.close(); srv.close();
