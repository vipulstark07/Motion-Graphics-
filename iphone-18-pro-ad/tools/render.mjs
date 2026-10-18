#!/usr/bin/env node
// Offline renderer: drives the film in headless Chromium frame by frame and
// encodes the result with ffmpeg.
//
//   node tools/render.mjs --stills 5.5,12,45 --out stills/     # PNG stills
//   node tools/render.mjs --video --out out/iphone-18-pro-film.mp4
//
// Options: --width 1920 --height 1080 --fps 30 --from 0 --to 48 --workers 2

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const width = Number(opt('width', 1920));
const height = Number(opt('height', 1080));
const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/timeline.json'), 'utf8'));
const fps = Number(opt('fps', timeline.fps));
const workers = Number(opt('workers', Math.max(1, Math.min(3, os.cpus().length - 1))));

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.png': 'image/png',
};
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()));
  await page.goto(`http://127.0.0.1:${port}/index.html?capture&w=${width}&h=${height}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  return page;
}

async function frame(page, t) {
  await page.evaluate((tt) => window.__renderFrame(tt), t);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
}

const server = await serve();
const port = server.address().port;
const browser = await playwright.chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

try {
  if (opt('stills')) {
    const out = path.resolve(opt('out', 'stills'));
    fs.mkdirSync(out, { recursive: true });
    const page = await openPage(browser, port);
    for (const s of opt('stills').split(',')) {
      const t = Number(s);
      const t0 = Date.now();
      const png = await frame(page, t);
      const file = path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`);
      fs.writeFileSync(file, png);
      console.log(`${file}  (${Date.now() - t0} ms)`);
    }
  } else if (flag('video')) {
    const out = path.resolve(opt('out', 'out/iphone-18-pro-film.mp4'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const from = Number(opt('from', 0));
    const to = Number(opt('to', timeline.duration));
    const total = Math.round((to - from) * fps);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'film-'));
    let done = 0;
    const started = Date.now();
    const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser, port)));
    await Promise.all(
      pages.map(async (page, w) => {
        for (let i = w; i < total; i += workers) {
          const png = await frame(page, from + i / fps);
          fs.writeFileSync(path.join(tmp, `f${String(i).padStart(5, '0')}.png`), png);
          done++;
          if (done % 30 === 0 || done === total) {
            const el = (Date.now() - started) / 1000;
            process.stdout.write(`\r${done}/${total} frames  ${(el / done).toFixed(2)} s/frame  eta ${Math.round((el / done) * (total - done))} s   `);
          }
        }
      }),
    );
    console.log('\nencoding…');
    const wav = path.join(ROOT, 'assets/audio/score.wav');
    const audioPath = fs.existsSync(wav) ? wav : path.join(ROOT, 'assets/audio/score.m4a');
    const audioArgs = fs.existsSync(audioPath) ? ['-ss', String(from), '-t', String(to - from), '-i', audioPath] : [];
    const ff = spawn('ffmpeg', [
      '-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, 'f%05d.png'),
      ...audioArgs,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      ...(audioArgs.length ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : []),
      '-movflags', '+faststart', out,
    ], { stdio: 'inherit' });
    await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg exited ${c}`)))));
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(out);
  } else {
    console.log('Pass --stills <t,t,...> or --video');
  }
} finally {
  await browser.close();
  server.close();
}
