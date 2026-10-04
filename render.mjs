#!/usr/bin/env node
// Motion studio renderer. See CLAUDE.md for the rules this enforces.
//
//   node render.mjs films/<name> --contact       one frame per beat -> out/contact.png + scorecard.md
//   node render.mjs films/<name> --frames 0,2.5  specific frames -> out/frames/
//   node render.mjs films/<name>                 full render (refused until scorecard.md is all 8+)
//   node render.mjs films/<name> --force         full render without the scorecard gate
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync, renameSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioSource, rawAudio, normalize, measureLufs, TARGET_LUFS } from './lib/audio.mjs';
import { measureBeats } from './lib/beats.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CRITERIA = ['Hook in first 2s', 'Readability at phone size', 'Motion quality', 'Variety', 'Brand accuracy', 'Sound sync'];
const PASS = 8;
const PHONE_WIDTH = 390;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const filmArg = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && ['--frames', '--fps'].includes(args[i - 1])));
if (!filmArg) {
  console.error('usage: node render.mjs films/<name> [--contact | --frames t1,t2 | --force] [--fps N]');
  process.exit(2);
}
const dir = resolve(filmArg);
const name = basename(dir);
const out = join(dir, 'out');
const film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8'));
film.fps = Number(opt('--fps') ?? film.fps ?? 30);
for (const k of ['width', 'height', 'duration']) if (!(film[k] > 0)) throw new Error(`film.json needs a positive "${k}"`);
mkdirSync(out, { recursive: true });

// ---------- static server (films import /lib/*.js, so file:// won't do) ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wav': 'audio/wav' };

function serve() {
  const server = createServer(async (req, res) => {
    let file = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    if (file.endsWith(sep)) file += 'index.html';
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

// ---------- render-contract guard ----------
// Flags Math.random always, and clocks/timers/rAF while seek() runs.
const GUARD = `(() => {
  const v = window.__violations = new Set();
  const wrap = (obj, key, label, always) => {
    const orig = obj[key];
    obj[key] = function (...a) { if (always || window.__rendering) v.add(label); return orig.apply(this, a); };
  };
  wrap(Math, 'random', 'Math.random()', true);
  wrap(window, 'setTimeout', 'setTimeout', false);
  wrap(window, 'setInterval', 'setInterval', false);
  wrap(window, 'requestAnimationFrame', 'requestAnimationFrame', false);
  wrap(Date, 'now', 'Date.now()', false);
  wrap(performance, 'now', 'performance.now()', false);
})();`;

async function openFilm(browser, base) {
  const page = await browser.newPage({ viewport: { width: film.width, height: film.height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(GUARD);
  await page.goto(`${base}/${relative(ROOT, dir).split(sep).join('/')}/index.html`);
  try {
    await page.waitForFunction(() => typeof window.seek === 'function', null, { timeout: 15000 });
  } catch {
    throw new Error(`film never defined window.seek(t)${errors.length ? `:\n  ${errors.join('\n  ')}` : ''}`);
  }
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}

async function frame(page, t) {
  const css = await page.evaluate(async (t) => {
    window.__rendering = true;
    try { await window.seek(t); } finally { window.__rendering = false; }
    await document.fonts.ready;
    return document.getAnimations()
      .filter((a) => a instanceof CSSTransition || a instanceof CSSAnimation)
      .map((a) => `CSS ${a instanceof CSSTransition ? 'transition' : 'animation'} (${a.transitionProperty ?? a.animationName})`);
  }, t);
  if (css.length) await page.evaluate((c) => c.forEach((x) => window.__violations.add(x)), css);
  return page.screenshot({ type: 'png' });
}

async function checkContract(page, errors) {
  const v = await page.evaluate(() => [...window.__violations]);
  if (errors.length) console.error(`\npage errors:\n  ${errors.join('\n  ')}`);
  if (v.length) {
    console.error(`\nRENDER CONTRACT VIOLATED: ${v.join(', ')}\n` +
      'Every frame must be a pure function of t: no CSS transitions, timers, rAF, clocks, or Math.random.');
    process.exitCode = 1;
  }
  return v.length === 0 && errors.length === 0;
}

// ---------- beats ----------
async function ensureBeats() {
  const file = join(dir, 'beats.json');
  const src = audioSource(dir);
  if (!src) return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  if (!existsSync(file) || statSync(file).mtimeMs < statSync(src.path).mtimeMs) {
    const audio = await rawAudio(dir, film);
    const grid = measureBeats(audio, film.duration);
    writeFileSync(file, JSON.stringify({ source: relative(dir, src.path), measured: true, ...grid }, null, 2) + '\n');
    console.log(`measured beat grid: ${grid.bpm} BPM, ${grid.beats.length} beats, first at ${grid.offset}s -> beats.json`);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

// ---------- scorecard ----------
const scorecardPath = join(dir, 'scorecard.md');

function readScores() {
  if (!existsSync(scorecardPath)) return null;
  const md = readFileSync(scorecardPath, 'utf8');
  return CRITERIA.map((c) => {
    const row = md.split('\n').find((l) => l.toLowerCase().includes(`| ${c.toLowerCase()} |`));
    return { criterion: c, score: Number(row?.split('|')[2]?.trim()) };
  });
}

function writeScorecardTemplate(round) {
  const rows = CRITERIA.map((c) => `| ${c} | - | |`).join('\n');
  writeFileSync(scorecardPath,
    `# Scorecard: ${name}\n\nRound ${round}. Score each 1-10 from out/contact.png. ` +
    `Fix the 3 worst, re-run --contact, repeat until every score is ${PASS}+.\n\n` +
    `| Criterion | Score | Worst problem / fix |\n|---|---|---|\n${rows}\n`);
}

// ---------- modes ----------
async function contact(page, grid) {
  let times = grid?.beats?.filter((t) => t < film.duration);
  if (!times?.length) {
    console.warn('no beats.json and no audio: sampling every 1s instead of every beat');
    times = Array.from({ length: Math.ceil(film.duration) }, (_, i) => i);
  }
  const framesDir = join(out, 'beats');
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const shots = [];
  for (const [i, t] of times.entries()) {
    const png = await frame(page, t);
    shots.push(png);
    writeFileSync(join(framesDir, `beat-${String(i).padStart(3, '0')}.png`), png);
  }

  // Purity: revisit frames in reverse order; any difference means state leaked between frames.
  const probe = [...new Set([times.length - 1, Math.floor(times.length / 2), Math.floor(times.length / 4), 0])];
  const impure = [];
  for (const i of probe) if (!(await frame(page, times[i])).equals(shots[i])) impure.push(times[i]);
  if (impure.length) {
    console.error(`\nRENDER CONTRACT VIOLATED: frames at t=${impure.join(', ')} differ when revisited out of order (state carried between frames).`);
    process.exitCode = 1;
  }

  const cols = film.width >= film.height ? 3 : 4;
  const rel = (f) => `beats/${basename(f)}`;
  const cells = times.map((t, i) => `<figure${t < 2 ? ' class="hook"' : ''}><img src="${rel(`beat-${String(i).padStart(3, '0')}.png`)}">` +
    `<figcaption><b>${i}</b> ${t.toFixed(2)}s${t < 2 ? ' · hook' : ''}</figcaption></figure>`).join('');
  writeFileSync(join(out, 'contact.html'), `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#161616;color:#bbb;font:14px/1.4 ui-monospace,monospace}
    h1{font-size:16px;color:#eee;margin:0 0 16px} .grid{display:grid;grid-template-columns:repeat(${cols},${PHONE_WIDTH}px);gap:20px 16px}
    figure{margin:0} img{display:block;width:${PHONE_WIDTH}px;outline:1px solid #333} .hook img{outline:2px solid #e5c000}
    figcaption{padding-top:6px} b{color:#eee}</style>
    <h1>${name} · ${film.width}x${film.height} · ${film.duration}s · ${grid?.bpm ? `${grid.bpm} BPM · ` : ''}${times.length} frames at phone width (${PHONE_WIDTH}px)</h1>
    <div class="grid">${cells}</div>`);
  const sheet = await page.context().browser().newPage();
  await sheet.setViewportSize({ width: 48 + cols * PHONE_WIDTH + (cols - 1) * 16, height: 800 });
  await sheet.goto(`${page.url().replace(/\/index\.html$/, '')}/out/contact.html`);
  await sheet.waitForFunction(() => [...document.images].every((i) => i.complete));
  await sheet.screenshot({ path: join(out, 'contact.png'), fullPage: true });
  await sheet.close();

  const prev = readScores();
  if (!prev) writeScorecardTemplate(1);
  console.log(`\ncontact sheet: ${relative(process.cwd(), join(out, 'contact.png'))} (${times.length} frames)`);
  console.log(`now LOOK at it and score ${relative(process.cwd(), scorecardPath)}: ${CRITERIA.join(', ')}.`);
}

async function frames(page, list) {
  const fdir = join(out, 'frames');
  mkdirSync(fdir, { recursive: true });
  for (const t of list) {
    const file = join(fdir, `t-${t.toFixed(3)}.png`);
    writeFileSync(file, await frame(page, t));
    console.log(relative(process.cwd(), file));
  }
}

function gate() {
  const scores = readScores();
  const failing = scores?.filter((s) => !(s.score >= PASS));
  if (!scores || failing.length) {
    console.error(`full render refused: every scorecard criterion must be ${PASS}+ first.\n` +
      (scores ? failing.map((s) => `  ${s.criterion}: ${Number.isNaN(s.score) ? 'unscored' : s.score}`).join('\n')
              : `  no ${relative(process.cwd(), scorecardPath)} yet: run with --contact`) +
      '\n(--force skips this gate)');
    process.exit(1);
  }
}

async function full(page) {
  const n = Math.round(film.duration * film.fps);
  const video = join(out, 'video.mp4');
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(film.fps), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', video],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = once(ff, 'close');
  const started = Date.now();
  for (let i = 0; i < n; i++) {
    if (!ff.stdin.write(await frame(page, i / film.fps))) await once(ff.stdin, 'drain');
    if (i % film.fps === 0 || i === n - 1) process.stdout.write(`\rframe ${i + 1}/${n}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  const [code] = await done;
  if (code !== 0) throw new Error(`ffmpeg exited ${code}`);
  console.log();

  const final = join(out, `${name}.mp4`);
  const raw = await rawAudio(dir, film);
  if (!raw) {
    console.warn('no track.* or score.mjs: rendering silent. The Sound rules expect a synthesized score.');
    renameSync(video, final);
  } else {
    const wav = join(out, 'audio.wav');
    const pre = normalize(raw, wav, film.duration);
    await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-v', 'error', '-i', video, '-i', wav, '-map', '0:v', '-map', '1:a',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', String(film.duration), '-movflags', '+faststart', final], { stdio: 'inherit' })
      .on('close', (c) => (c === 0 ? res() : rej(new Error(`mux failed (${c})`)))));
    rmSync(video);
    const post = measureLufs(final);
    console.log(`loudness: ${post.lufs} LUFS integrated (target ${TARGET_LUFS}), true peak ${post.truePeak} dBFS [pre-mux ${pre.lufs}]`);
    if (Math.abs(post.lufs - TARGET_LUFS) > 1) { console.error('loudness off target by more than 1 LU'); process.exitCode = 1; }
  }
  console.log(`rendered ${relative(process.cwd(), final)}: ${film.width}x${film.height} ${film.fps}fps, H.264 yuv420p CRF 16`);
}

// ---------- main ----------
const mode = flag('--contact') ? 'contact' : opt('--frames') ? 'frames' : 'full';
if (mode === 'full' && !flag('--force')) gate();
const grid = await ensureBeats(); // before load: the film may fetch beats.json

const server = await serve();
const browser = await chromium.launch();
try {
  const { page, errors } = await openFilm(browser, `http://127.0.0.1:${server.address().port}`);
  if (mode === 'contact') await contact(page, grid);
  else if (mode === 'frames') await frames(page, opt('--frames').split(',').map(Number));
  else await full(page);
  await checkContract(page, errors);
} finally {
  await browser.close();
  server.close();
}
