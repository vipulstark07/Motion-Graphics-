// Builds the kitchen in headless Chromium, exports GLB, then optimises it with glTF-Transform.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, meshopt, quantize, inspect } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
fs.mkdirSync(DIST, { recursive: true });

const { srv, port } = await serve(ROOT);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => { console.error('[pageerror]', e); process.exitCode = 1; });
await page.goto(`http://127.0.0.1:${port}/tools/build.html`);
await page.waitForFunction(() => window.__ready);
const res = await page.evaluate(() => window.exportKitchen());
await browser.close(); srv.close();
console.log('stats', res.stats, `build ${res.buildMs.toFixed(0)}ms export ${res.exportMs.toFixed(0)}ms`);

const raw = Buffer.from(res.b64, 'base64');
const rawPath = path.join(DIST, 'kitchen-raw.glb');
fs.writeFileSync(rawPath, raw);

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// 1) Universal version: no compression extensions required (Spline, model-viewer, Blender, etc.)
let doc = await io.readBinary(raw);
await doc.transform(dedup(), weld(), prune());
fs.writeFileSync(path.join(DIST, 'kitchen-uncompressed.glb'), await io.writeBinary(doc));

// 2) Web version: quantized + meshopt compressed (three.js GLTFLoader + MeshoptDecoder)
doc = await io.readBinary(raw);
await doc.transform(dedup(), weld(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
fs.writeFileSync(path.join(DIST, 'kitchen.glb'), await io.writeBinary(doc));
fs.unlinkSync(rawPath);

for (const f of ['kitchen.glb', 'kitchen-uncompressed.glb']) console.log(f, (fs.statSync(path.join(DIST, f)).size / 1024).toFixed(0) + ' KB');
const report = inspect(doc);
console.log('meshes', report.meshes.properties.length, 'materials', report.materials.properties.length, 'textures', report.textures.properties.map((t) => `${t.resolution} ${t.mimeType} ${(t.size / 1024).toFixed(0)}KB`).join(', '));
