#!/usr/bin/env node
// Packs the film into one self-contained HTML file (scripts, font, timeline
// and score inlined) that plays straight from disk with a double-click.
//
//   node tools/build-standalone.mjs   ->   dist/iphone-18-pro-film.html

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(path.join(ROOT, p));

// Module key for every file: bare specifiers that the import map resolves.
function keyFor(file) {
  const r = rel(file);
  if (r === 'vendor/three/three.module.min.js') return 'three';
  if (r.startsWith('vendor/three/addons/')) return `three/addons/${r.slice('vendor/three/addons/'.length)}`;
  if (r.startsWith('js/')) return `app/${r.slice(3)}`;
  throw new Error(`unexpected module ${r}`);
}

const files = [
  path.join(ROOT, 'vendor/three/three.module.min.js'),
  ...fs.readdirSync(path.join(ROOT, 'vendor/three/addons/postprocessing')).map((f) => path.join(ROOT, 'vendor/three/addons/postprocessing', f)),
  ...fs.readdirSync(path.join(ROOT, 'vendor/three/addons/shaders')).map((f) => path.join(ROOT, 'vendor/three/addons/shaders', f)),
  ...fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, 'js', f)),
];

const imports = {};
for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(/(from\s*|import\s*)(['"])(\.{1,2}\/[^'"]+)\2/g, (_, pre, q, spec) => {
    const target = path.resolve(path.dirname(file), spec);
    return `${pre}${q}${keyFor(target)}${q}`;
  });
  imports[keyFor(file)] = `data:text/javascript;base64,${Buffer.from(src).toString('base64')}`;
}

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const font = `data:font/woff2;base64,${read('assets/fonts/InterVariable-opsz.woff2').toString('base64')}`;
const audio = `data:audio/mpeg;base64,${read('assets/audio/score.mp3').toString('base64')}`;
const timeline = JSON.stringify(JSON.parse(read('assets/timeline.json')));

const swap = (from, to) => {
  if (!html.includes(from)) throw new Error(`build: marker not found: ${from}`);
  html = html.replace(from, to);
};
swap(/<link rel="preload"[^>]*>\n\s*/.exec(html)[0], '');
swap('url("assets/fonts/InterVariable-opsz.woff2")', `url("${font}")`);
swap(/<script type="importmap">[\s\S]*?<\/script>/.exec(html)[0], `<script type="importmap">${JSON.stringify({ imports })}</script>`);
swap('src="assets/audio/score.mp3"', `src="${audio}"`);
swap('<script type="module" src="js/film.js"></script>', `<script>window.__TIMELINE = ${timeline};</script>\n  <script type="module">import 'app/film.js';</script>`);

const out = path.join(ROOT, 'dist/iphone-18-pro-film.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${rel(out)}  ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
