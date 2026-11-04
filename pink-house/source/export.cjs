// Builds pink-house.glb and pink-house.html from house-model.js and viewer-template.html,
// using headless Chromium (Playwright) and three.js's GLTFExporter.
//
//   npm i three@0.160.0 playwright
//   THREE_DIR=./node_modules/three node pink-house/source/export.cjs
//
// Output goes next to this folder: pink-house/pink-house.glb and pink-house/pink-house.html

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const OUT = path.join(__dirname, '..');
const THREE_DIR = process.env.THREE_DIR || path.dirname(require.resolve('three/package.json'));

const page = `<!doctype html><html><head><script type="importmap">
{ "imports": { "three": "/three/build/three.module.js", "three/addons/": "/three/examples/jsm/" } }
</script></head><body><script type="module">
  import * as THREE from 'three';
  import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
  import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
  import { buildHouse, PINK_WASH_LIGHTS } from '/src/house-model.js';
  const group = buildHouse(THREE, mergeGeometries);
  const scene = new THREE.Scene(); scene.name = 'PinkResidenceScene'; scene.add(group);
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  let s = ''; const b = new Uint8Array(glb);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  window.__result = { glb: btoa(s), lights: PINK_WASH_LIGHTS };
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = null;
  if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(page); }
  if (url.startsWith('/three/')) file = path.join(THREE_DIR, url.slice(7));
  if (url.startsWith('/src/')) file = path.join(SRC, url.slice(5));
  if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/javascript' });
  fs.createReadStream(file).pipe(res);
}).listen(0, async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage();
  p.on('pageerror', (e) => console.error('pageerror:', e.message));
  await p.goto(`http://localhost:${server.address().port}/`);
  await p.waitForFunction(() => window.__result, null, { timeout: 60000 });
  const { glb, lights } = await p.evaluate(() => window.__result);
  await browser.close();
  server.close();

  fs.writeFileSync(path.join(OUT, 'pink-house.glb'), Buffer.from(glb, 'base64'));
  const html = fs.readFileSync(path.join(SRC, 'viewer-template.html'), 'utf8')
    .replace('__GLB_BASE64__', glb)
    .replace('__PINK_WASH_LIGHTS__', JSON.stringify(lights.map((v) => v.map((n) => +n.toFixed(3)))));
  fs.writeFileSync(path.join(OUT, 'pink-house.html'), html);
  console.log('glb bytes', Buffer.from(glb, 'base64').length, 'html bytes', html.length);
});
