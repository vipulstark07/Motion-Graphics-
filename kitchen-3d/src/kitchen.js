// Procedural luxury kitchen — built for real-time web use.
// Units: metres. +Y up. Kitchen back wall at -Z, side wall at -X, open to +X/+Z.
// Geometry is merged per (group, material) to keep draw calls low.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- RNG
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = mulberry32(1337);
const seed = (s) => { rand = mulberry32(s); };
const rr = (a, b) => a + (b - a) * rand();
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- tileable noise
function makeNoise(px, py, s) {
  const r = mulberry32(s); const g = new Float32Array(px * py);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    x *= px; y *= py;
    const xi = Math.floor(x), yi = Math.floor(y);
    let xf = x - xi, yf = y - yi;
    xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf);
    const i0 = ((xi % px) + px) % px, i1 = (i0 + 1) % px;
    const j0 = ((yi % py) + py) % py, j1 = (j0 + 1) % py;
    const a = g[j0 * px + i0], b = g[j0 * px + i1], c = g[j1 * px + i0], d = g[j1 * px + i1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}
function makeFbm(base, oct, s, ax = 1, ay = 1) {
  const ns = [];
  for (let k = 0; k < oct; k++) ns.push(makeNoise(Math.round(base * ax * 2 ** k), Math.round(base * ay * 2 ** k), s + k * 101));
  return (x, y) => { let v = 0, a = 1, t = 0; for (const n of ns) { v += a * n(x, y); t += a; a *= 0.5; } return v / t; };
}

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function marbleCanvas(size, s, { grout = false, veins = 1, warm = 0 } = {}) {
  const c = canvas(size); const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size); const d = img.data;
  const f1 = makeFbm(2, 4, s), f2 = makeFbm(3, 4, s + 40), f3 = makeFbm(2, 3, s + 80), f4 = makeFbm(6, 4, s + 120);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = i / size, y = j / size;
      const t = f1(x, y), t2 = f2(x, y), m = f3(x, y), fine = f4(x, y);
      const v1 = Math.abs(Math.sin(TAU * (x + y) + t * 6.5));
      const v2 = Math.abs(Math.sin(TAU * (2 * x - y) + t2 * 8));
      const v3 = Math.abs(Math.sin(TAU * (3 * x + 2 * y) + fine * 9 + t * 4));
      let vein = Math.pow(1 - v1, 16) * (0.35 + 0.65 * smooth(0.35, 0.65, m))
        + Math.pow(1 - v2, 34) * 0.5 * smooth(0.4, 0.7, 1 - m)
        + Math.pow(1 - v3, 70) * 0.28
        + Math.pow(1 - v1, 4) * 0.07; // soft halo around main veins
      vein = Math.min(1, vein * veins);
      const cloud = (t - 0.5) * 0.09 + (fine - 0.5) * 0.035;
      let r = 245 + warm + cloud * 70, g = 243 + cloud * 70, b = 240 - warm + cloud * 70;
      r = r * (1 - vein) + 122 * vein; g = g * (1 - vein) + 121 * vein; b = b * (1 - vein) + 124 * vein;
      if (grout) {
        const gx = (x * 2) % 1, gy = (y * 2) % 1;
        const dx = Math.min(gx, 1 - gx) * size / 2, dy = Math.min(gy, 1 - gy) * size / 2;
        const dd = Math.min(dx, dy);
        const k = 1 - smooth(0.6, 1.8, dd);
        r = r * (1 - k * 0.12); g = g * (1 - k * 0.12); b = b * (1 - k * 0.11);
      }
      const o = (j * size + i) * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function walnutCanvas(size, s) {
  const c = canvas(size); const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size); const d = img.data;
  const g1 = makeFbm(3, 5, s, 6, 1), g2 = makeFbm(4, 4, s + 33, 24, 1), g3 = makeFbm(4, 3, s + 66, 2, 2);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = i / size, y = j / size;
      const a = g1(x, y), b = g2(x, y), m = g3(x, y);
      const ring = 0.5 + 0.5 * Math.sin(TAU * 14 * x + a * 16);
      let t = Math.pow(ring, 1.6) * 0.55 + b * 0.35 + (m - 0.5) * 0.3;
      t = Math.min(1, Math.max(0, t));
      const r = 66 + t * 70, gg = 39 + t * 44, bb = 22 + t * 26;
      const o = (j * size + i) * 4;
      d[o] = r; d[o + 1] = gg; d[o + 2] = bb; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Soft glow decal: rect (in 0..1 uv space) with exponential falloff outside it.
function glowCanvas(w, h, rect, falloff, peak = 1) {
  const c = canvas(w, h); const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h); const d = img.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w, v = (j + 0.5) / h;
    const dx = Math.max(rect[0] - u, 0, u - rect[2]);
    const dy = Math.max(rect[1] - v, 0, v - rect[3]);
    const dist = Math.hypot(dx, dy);
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const a = peak * Math.exp(-dist / falloff) * smooth(0, 0.08, edge);
    const o = (j * w + i) * 4;
    d[o] = 255; d[o + 1] = 196; d[o + 2] = 132; d[o + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
// Vertical wash (bright at top), for backsplash under-cabinet light.
function washCanvas(w, h) {
  const c = canvas(w, h); const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h); const d = img.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w, v = 1 - (j + 0.5) / h; // v=1 at top of image
    const a = 0.75 * Math.pow(v, 3.2) * smooth(0, 0.04, Math.min(u, 1 - u));
    const o = (j * w + i) * 4;
    d[o] = 255; d[o + 1] = 200; d[o + 2] = 140; d[o + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(c, { jpeg = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  if (jpeg) t.userData.mimeType = 'image/jpeg';
  return t;
}

// ---------------------------------------------------------------- materials
function makeMaterials() {
  const marble = tex(marbleCanvas(1024, 11, { veins: 1 }));
  const floor = tex(marbleCanvas(1024, 23, { veins: 0.5, grout: true, warm: 1 }));
  const walnut = tex(walnutCanvas(512, 5));

  const M = {};
  const std = (name, p, uvScale) => {
    const m = new THREE.MeshStandardMaterial({ name, ...p });
    if (uvScale) m.userData.uvScale = uvScale;
    M[name] = m; return m;
  };
  std('Cabinet_Taupe', { color: 0x9b9189, roughness: 0.62, metalness: 0 });
  std('Cabinet_Carcass', { color: 0x4a4440, roughness: 0.8 });
  std('Marble_Counter', { map: marble, roughness: 0.16 }, 1.7);
  std('Marble_Floor', { map: floor, roughness: 0.14 }, 2.4);
  std('Plinth_White', { color: 0xf6f5f3, roughness: 0.25 });
  std('Wall_White', { color: 0xeeebe7, roughness: 0.85 });
  std('Ceiling_White', { color: 0xf7f6f4, roughness: 0.7 });
  std('Walnut', { map: walnut, roughness: 0.55 }, 0.9);
  // interior walnut that reads as lit by the cabinet LEDs (fake bounce light)
  std('Walnut_Lit', { map: walnut, emissive: 0xffb06a, emissiveMap: walnut, emissiveIntensity: 0.9, roughness: 0.5 }, 0.9);
  std('Metal_Black', { color: 0x161616, roughness: 0.35, metalness: 0.7 });
  std('Matte_Black', { color: 0x121212, roughness: 0.75 });
  std('Glass_Clear', { color: 0xe8f1f2, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  std('Glass_Shelf', { color: 0xd6ebe6, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false });
  std('LED_Warm', { color: 0xfff1de, emissive: 0xffc27a, emissiveIntensity: 6, roughness: 0.4 });
  std('Upholstery_Cream', { color: 0xe6ddd1, roughness: 0.95 });
  std('Leaf_Green', { color: 0x4f8a35, roughness: 0.55, side: THREE.DoubleSide });
  std('Leaf_Dark', { color: 0x2d6024, roughness: 0.55, side: THREE.DoubleSide });
  std('Leaf_Light', { color: 0x7fae45, roughness: 0.55, side: THREE.DoubleSide });
  std('Stem', { color: 0x5d6b33, roughness: 0.7 });
  std('Pot_Stone', { map: marble, color: 0xf2f0ec, roughness: 0.45 }, 0.6);
  std('Soil', { color: 0x2b211a, roughness: 1 });
  std('Ceramic_White', { color: 0xf3f1ed, roughness: 0.28 });
  std('Ceramic_Charcoal', { color: 0x2f2d2b, roughness: 0.4 });
  std('Oven_Glass', { color: 0x0b0b0c, roughness: 0.08, metalness: 0.3 });
  std('Oven_Window', { color: 0x020202, roughness: 0.05, metalness: 0.5 });
  std('Display_Glow', { color: 0x000000, emissive: 0x9fe2ff, emissiveIntensity: 3 });
  std('Cooktop', { color: 0x070707, roughness: 0.06, metalness: 0.2 });
  std('Cooktop_Mark', { color: 0x3a3a3a, roughness: 0.3 });
  std('Sink_Graphite', { color: 0x2a2a2b, roughness: 0.45, metalness: 0.2 });
  std('Wood_Board', { map: walnut, color: 0xe8b98a, roughness: 0.6 }, 0.7);
  std('Apple_Green', { color: 0x9cc23a, roughness: 0.35 });
  std('Blossom', { color: 0xf7f0e2, roughness: 0.7 });
  std('Branch', { color: 0x5a4632, roughness: 0.9 });

  const glowTexIsland = tex(glowCanvas(256, 512, [0.27, 0.12, 0.62, 0.88], 0.09), { jpeg: false, repeat: false });
  M.Glow_Floor = new THREE.MeshStandardMaterial({
    name: 'Glow_Floor', color: 0x000000, map: glowTexIsland, emissive: 0xffc58a, emissiveMap: glowTexIsland,
    emissiveIntensity: 1.6, transparent: true, depthWrite: false, roughness: 1,
  });
  const washTex = tex(washCanvas(64, 128), { jpeg: false, repeat: false });
  M.Glow_Wash = new THREE.MeshStandardMaterial({
    name: 'Glow_Wash', color: 0x000000, map: washTex, emissive: 0xffd2a0, emissiveMap: washTex,
    emissiveIntensity: 1.1, transparent: true, depthWrite: false, roughness: 1,
  });
  return M;
}

// ---------------------------------------------------------------- geometry helpers
function worldUV(g, scale) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / scale + 0.37; uv[i * 2 + 1] = v / scale + 0.11;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

const _o = new THREE.Object3D();
function T(g, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  _o.position.set(p[0], p[1], p[2]); _o.rotation.set(r[0], r[1], r[2]); _o.scale.set(s[0], s[1], s[2]);
  _o.updateMatrix(); g.applyMatrix4(_o.matrix); return g;
}
function box(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g;
}
function rbox(x0, x1, y0, y1, z0, z1, r = 0.004, seg = 2) {
  const g = new RoundedBoxGeometry(x1 - x0, y1 - y0, z1 - z0, seg, r);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g;
}
function rod(a, b, r, seg = 8, rTop = r) {
  const A = new V3(...a), B = new V3(...b); const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(rTop, r, len, seg, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate(A.x, A.y, A.z); return g;
}
function lathe(pts, seg = 16) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); }
function cyl(r, h, seg = 16, rTop = r) { const g = new THREE.CylinderGeometry(rTop, r, h, seg); g.translate(0, h / 2, 0); return g; }

// Shapes are authored in plan view (x, z); internally shape-Y = -z so extrusion maps back correctly.
function rrShape(x0, x1, z0, z1, r) {
  const R = typeof r === 'number' ? { fl: r, fr: r, br: r, bl: r } : { fl: 0, fr: 0, br: 0, bl: 0, ...r };
  const Y0 = -z1, Y1 = -z0; const s = new THREE.Shape();
  s.moveTo(x0 + R.fl, Y0);
  s.lineTo(x1 - R.fr, Y0); if (R.fr) s.absarc(x1 - R.fr, Y0 + R.fr, R.fr, -Math.PI / 2, 0);
  s.lineTo(x1, Y1 - R.br); if (R.br) s.absarc(x1 - R.br, Y1 - R.br, R.br, 0, Math.PI / 2);
  s.lineTo(x0 + R.bl, Y1); if (R.bl) s.absarc(x0 + R.bl, Y1 - R.bl, R.bl, Math.PI / 2, Math.PI);
  s.lineTo(x0, Y0 + R.fl); if (R.fl) s.absarc(x0 + R.fl, Y0 + R.fl, R.fl, Math.PI, Math.PI * 1.5);
  return s;
}
function slab(shape, y0, y1, bevel = 0, curveSegments = 24) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0005, y1 - y0 - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 2, curveSegments,
  });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + bevel, 0); return g;
}

// Leaf: base at origin, grows along +Z, width along X, face normal +Y.
const LEAF_PROFILES = {
  oblong: (t) => Math.pow(Math.sin(Math.PI * t), 0.55) * (1 - 0.15 * t),
  heart: (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.75),
  lance: (t) => Math.pow(Math.sin(Math.PI * t), 0.95),
};
function leafGeom(len, wid, { shape = 'oblong', fold = 0.3, droop = 0.3, twist = 0, segL = 10, segW = 3 } = {}) {
  const prof = LEAF_PROFILES[shape];
  const cols = segW * 2 + 1; const pos = []; const uvs = []; const idx = [];
  for (let i = 0; i <= segL; i++) {
    const t = i / segL; const hw = wid * 0.5 * prof(t);
    for (let j = -segW; j <= segW; j++) {
      const u = j / segW; let x = u * hw;
      let y = fold * Math.abs(u) * hw - droop * len * t * t;
      let z = t * len * (1 - 0.25 * droop * t);
      // ruffled edge
      y += Math.abs(u) * 0.012 * len * Math.sin(t * 9 + j);
      if (twist) { const a = twist * t; const xx = x * Math.cos(a) - y * Math.sin(a); y = x * Math.sin(a) + y * Math.cos(a); x = xx; }
      pos.push(x, y, z); uvs.push((u + 1) / 2, t);
    }
  }
  for (let i = 0; i < segL; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function orient(g, at, dir, roll = 0) {
  _o.position.copy(at); _o.rotation.set(0, 0, 0); _o.scale.set(1, 1, 1);
  _o.up.set(0, 1, 0);
  if (Math.abs(dir.clone().normalize().y) > 0.995) _o.up.set(1, 0, 0);
  _o.lookAt(at.clone().add(dir)); _o.rotateZ(roll); _o.updateMatrix();
  g.applyMatrix4(_o.matrix); return g;
}

// ---------------------------------------------------------------- builder
export function buildKitchen() {
  seed(1337);
  const M = makeMaterials();
  const buckets = new Map();
  const add = (group, m, g) => {
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (m.userData.uvScale) worldUV(g, m.userData.uvScale);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups(); g.morphAttributes = {};
    const key = group + '|' + m.name;
    if (!buckets.has(key)) buckets.set(key, { group, m, geoms: [] });
    buckets.get(key).geoms.push(g);
  };

  // =============== STAGE: platform, walls, canopy
  const G_STAGE = 'Stage';
  const PX0 = -3.55, PX1 = 3.7, PZ0 = -3.0, PZ1 = 2.75;
  add(G_STAGE, M.Plinth_White, slab(rrShape(PX0, PX1, PZ0, PZ1, 0.6), -0.16, -0.002, 0.012, 32));
  {
    const g = new THREE.ShapeGeometry(rrShape(PX0 + 0.012, PX1 - 0.012, PZ0 + 0.012, PZ1 - 0.012, 0.59), 32);
    g.rotateX(-Math.PI / 2); add(G_STAGE, M.Marble_Floor, g);
  }
  // walls
  add(G_STAGE, M.Wall_White, box(-2.62, 2.75, 0, 2.8, -2.62, -2.5));
  add(G_STAGE, M.Wall_White, box(-2.62, -2.5, 0, 2.8, -2.5, 1.0));
  // canopy: outer slab + inset drop panel + LED cove line
  const CX0 = -2.62, CX1 = 2.75, CZ0 = -2.62, CZ1 = 1.35, CR = 0.9;
  add(G_STAGE, M.Ceiling_White, slab(rrShape(CX0, CX1, CZ0, CZ1, { fr: CR, fl: 0.12 }), 2.8, 2.97, 0.012, 40));
  const INS = 0.17;
  add(G_STAGE, M.Ceiling_White, slab(rrShape(CX0, CX1 - INS, CZ0, CZ1 - INS, { fr: CR - INS, fl: 0.06 }), 2.7, 2.8, 0, 40));
  {
    const pts = []; const y = 2.792; const off = INS - 0.012;
    const xr = CX1 - off, zf = CZ1 - off, r = CR - off, cx = CX1 - CR, cz = CZ1 - CR;
    pts.push(new V3(-2.5, y, zf));
    for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 - (i / 16) * Math.PI / 2; pts.push(new V3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r)); }
    pts.push(new V3(xr, y, -2.5));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const g = new THREE.TubeGeometry(curve, 120, 0.009, 6, false);
    add(G_STAGE, M.LED_Warm, g);
  }

  // =============== CABINETRY
  const G_CAB = 'Cabinets';
  const GAP = 0.0016, FT = 0.019; // reveal gap, front thickness
  const frontX = (xf, z0, z1, y0, y1, dir = 1, m = M.Cabinet_Taupe) =>
    add(G_CAB, m, box(dir > 0 ? xf : xf - FT, dir > 0 ? xf + FT : xf, y0 + GAP, y1 - GAP, z0 + GAP, z1 - GAP));
  const frontZ = (zf, x0, x1, y0, y1, dir = 1, m = M.Cabinet_Taupe) =>
    add(G_CAB, m, box(x0 + GAP, x1 - GAP, y0 + GAP, y1 - GAP, dir > 0 ? zf : zf - FT, dir > 0 ? zf + FT : zf));

  // --- base run, left wall (fronts face +X)
  add(G_CAB, M.Cabinet_Carcass, box(-2.5, -1.92, 0.1, 0.86, -2.5, 0.35));
  add(G_CAB, M.Matte_Black, box(-2.5, -1.98, 0, 0.1, -2.5, 0.35));
  add(G_CAB, M.Matte_Black, box(-1.92, -1.914, 0.8, 0.86, -1.9, 0.35)); // gola channel
  for (const [z0, z1] of [[-1.9, -1.2], [-1.2, -0.42], [-0.42, 0.35]]) {
    frontX(-1.92, z0, z1, 0.1, 0.45); frontX(-1.92, z0, z1, 0.45, 0.8);
  }
  // --- base run, back wall (fronts face +Z)
  add(G_CAB, M.Cabinet_Carcass, box(-1.92, 1.2, 0.1, 0.86, -2.5, -1.92));
  add(G_CAB, M.Matte_Black, box(-1.98, 1.2, 0, 0.1, -2.5, -1.98));
  add(G_CAB, M.Matte_Black, box(-1.9, 1.2, 0.8, 0.86, -1.92, -1.914));
  for (const [x0, x1] of [[-1.9, -1.15], [-1.15, -0.55], [-0.55, 0.05]]) {
    frontZ(-1.92, x0, x1, 0.1, 0.36); frontZ(-1.92, x0, x1, 0.36, 0.58); frontZ(-1.92, x0, x1, 0.58, 0.8);
  }
  frontZ(-1.92, 0.05, 0.62, 0.1, 0.8); frontZ(-1.92, 0.62, 1.2, 0.1, 0.8);

  // --- countertops + backsplash (marble)
  add(G_CAB, M.Marble_Counter, rbox(-2.5, -1.89, 0.86, 0.9, -2.5, 0.35, 0.004));
  add(G_CAB, M.Marble_Counter, rbox(-1.89, 1.2, 0.86, 0.9, -2.5, -1.89, 0.004));
  add(G_CAB, M.Marble_Counter, box(-2.5, -2.488, 0.9, 1.45, -2.488, 0.35));
  add(G_CAB, M.Marble_Counter, box(-2.5, 1.2, 0.9, 1.45, -2.5, -2.488));

  // --- upper cabinets, left wall
  add(G_CAB, M.Cabinet_Carcass, box(-2.5, -2.17, 1.45, 2.05, -1.45, 0.35));
  add(G_CAB, M.Cabinet_Carcass, box(-2.5, -2.17, 1.45, 2.45, -2.5, -1.45));
  const niches = [[-0.25, 0.35], [-0.85, -0.25], [-1.45, -0.85]];
  for (const [z0, z1] of niches) {
    frontX(-2.17, z0, z1, 1.45, 2.05);
    // open niche lined in walnut, lit from the top
    add(G_CAB, M.Walnut_Lit, box(-2.49, -2.15, 2.05, 2.068, z0, z1));        // floor
    add(G_CAB, M.Walnut_Lit, box(-2.49, -2.15, 2.432, 2.45, z0, z1));        // ceiling
    add(G_CAB, M.Walnut_Lit, box(-2.49, -2.15, 2.068, 2.432, z0, z0 + 0.016)); // side
    add(G_CAB, M.Walnut_Lit, box(-2.49, -2.15, 2.068, 2.432, z1 - 0.016, z1)); // side
    add(G_CAB, M.Walnut_Lit, box(-2.5, -2.485, 2.068, 2.432, z0, z1));       // back
    add(G_CAB, M.LED_Warm, box(-2.2, -2.185, 2.426, 2.432, z0 + 0.02, z1 - 0.02));
  }
  frontX(-2.17, -2.15, -1.8, 1.45, 2.45); frontX(-2.17, -1.8, -1.45, 1.45, 2.45);
  // --- upper cabinets, back wall
  add(G_CAB, M.Cabinet_Carcass, box(-2.5, 0.45, 1.45, 2.45, -2.5, -2.17));
  for (const [x0, x1] of [[-2.15, -1.5], [-1.5, -0.85], [-0.85, -0.2], [-0.2, 0.45]]) frontZ(-2.17, x0, x1, 1.45, 2.45);
  // under-cabinet LED strips
  add(G_CAB, M.LED_Warm, box(-2.21, -2.19, 1.438, 1.45, -2.15, 0.35));
  add(G_CAB, M.LED_Warm, box(-2.15, 1.2, 1.438, 1.45, -2.21, -2.19));
  // bulkheads up to the canopy drop
  add(G_CAB, M.Cabinet_Taupe, box(-2.5, -2.151, 2.45, 2.7, -2.5, 0.35));
  add(G_CAB, M.Cabinet_Taupe, box(-2.5, 1.2, 2.45, 2.7, -2.5, -2.151));
  add(G_CAB, M.Cabinet_Taupe, box(-2.5, -1.87, 2.45, 2.7, 0.35, 1.03));
  add(G_CAB, M.Cabinet_Taupe, box(1.2, 2.62, 2.45, 2.7, -2.5, -1.851));

  // --- tall unit: pantry + double oven column
  add(G_CAB, M.Cabinet_Carcass, box(1.2, 2.6, 0.1, 2.45, -2.5, -1.87));
  add(G_CAB, M.Matte_Black, box(1.2, 2.62, 0, 0.1, -2.5, -1.93));
  add(G_CAB, M.Cabinet_Taupe, box(2.6, 2.62, 0.1, 2.45, -2.5, -1.851)); // finished end panel
  frontZ(-1.87, 1.2, 1.86, 0.1, 1.27); frontZ(-1.87, 1.2, 1.86, 1.27, 2.45);
  add(G_CAB, M.Matte_Black, box(1.86, 1.9, 0.1, 2.45, -1.87, -1.864)); // vertical gola
  frontZ(-1.87, 1.9, 2.6, 0.1, 0.72); frontZ(-1.87, 1.9, 2.6, 1.92, 2.45);
  const oven = (x0, x1, y0, y1, zf) => {
    add(G_CAB, M.Oven_Glass, rbox(x0 + 0.004, x1 - 0.004, y0 + 0.004, y1 - 0.004, zf, zf + 0.024, 0.004));
    add(G_CAB, M.Oven_Window, box(x0 + 0.07, x1 - 0.07, y0 + 0.07, y1 - 0.16, zf + 0.024, zf + 0.026));
    add(G_CAB, M.Metal_Black, box(x0 + 0.02, x1 - 0.02, y1 - 0.085, y1 - 0.082, zf + 0.024, zf + 0.026));
    add(G_CAB, M.Display_Glow, box((x0 + x1) / 2 - 0.05, (x0 + x1) / 2 + 0.05, y1 - 0.06, y1 - 0.035, zf + 0.024, zf + 0.0255));
    for (const dx of [-0.2, -0.16, 0.16, 0.2]) add(G_CAB, M.Display_Glow, box((x0 + x1) / 2 + dx - 0.006, (x0 + x1) / 2 + dx + 0.006, y1 - 0.052, y1 - 0.043, zf + 0.024, zf + 0.0255));
    const hy = y1 - 0.115, hz = zf + 0.06;
    add(G_CAB, M.Metal_Black, rod([x0 + 0.07, hy, hz], [x1 - 0.07, hy, hz], 0.009, 10));
    for (const hx of [x0 + 0.09, x1 - 0.09]) add(G_CAB, M.Metal_Black, rod([hx, hy, zf + 0.024], [hx, hy, hz], 0.006, 8));
  };
  oven(1.9, 2.6, 0.72, 1.32, -1.87); oven(1.9, 2.6, 1.32, 1.92, -1.87);

  // --- cooktop
  add(G_CAB, M.Cooktop, rbox(-0.98, -0.12, 0.9, 0.906, -2.42, -1.98, 0.003));
  for (const [x, z, r] of [[-0.78, -2.3, 0.1], [-0.33, -2.3, 0.085], [-0.78, -2.1, 0.075], [-0.33, -2.1, 0.095]]) {
    const g = new THREE.RingGeometry(r - 0.004, r, 40); g.rotateX(-Math.PI / 2); g.translate(x, 0.9065, z);
    add(G_CAB, M.Cooktop_Mark, g);
  }

  // --- glass display cabinets (built in local space: front faces +Z, width along +X)
  const glassCabinet = (group, { W, D, H, doors, shelves, plinth = 0, origin, ry = 0, fill }) => {
    const parts = [];
    const P = (m, g) => parts.push([m, g]);
    const f = 0.026;
    P(M.Walnut_Lit, box(0, W, plinth, H, -D, -D + 0.015));
    P(M.Walnut_Lit, box(0, 0.018, plinth, H, -D, -0.02));
    P(M.Walnut_Lit, box(W - 0.018, W, plinth, H, -D, -0.02));
    P(M.Metal_Black, box(0, W, H - 0.02, H, -D, 0));
    P(M.Walnut_Lit, box(0.018, W - 0.018, plinth, plinth + 0.02, -D, -0.02));
    if (plinth) P(M.Matte_Black, box(0.0, W, 0, plinth, -D + 0.04, -0.04));
    // front frame + glass
    P(M.Metal_Black, box(0, f, plinth, H, -0.02, 0.012));
    P(M.Metal_Black, box(W - f, W, plinth, H, -0.02, 0.012));
    P(M.Metal_Black, box(0, W, plinth, plinth + f, -0.02, 0.012));
    P(M.Metal_Black, box(0, W, H - f, H, -0.02, 0.012));
    if (doors === 2) P(M.Metal_Black, box(W / 2 - 0.012, W / 2 + 0.012, plinth, H, -0.02, 0.012));
    P(M.Glass_Clear, box(f, W - f, plinth + f, H - f, -0.006, -0.002));
    // vertical LED strips inside the front frame
    P(M.LED_Warm, box(0.02, 0.028, plinth + 0.03, H - 0.03, -0.034, -0.026));
    P(M.LED_Warm, box(W - 0.028, W - 0.02, plinth + 0.03, H - 0.03, -0.034, -0.026));
    for (const y of shelves) {
      P(M.Glass_Shelf, box(0.018, W - 0.018, y - 0.008, y, -D + 0.015, -0.025));
      P(M.LED_Warm, box(0.03, W - 0.03, y - 0.013, y - 0.008, -0.05, -0.04));
    }
    if (fill) fill(P);
    for (const [m, g] of parts) add(group, m, T(g, { p: origin, r: [0, ry, 0] }));
  };

  // tableware
  const wineGlass = (x, y, z, s = 1) => T(lathe([[0, 0], [0.034, 0], [0.034, 0.003], [0.006, 0.006], [0.0035, 0.012], [0.003, 0.085],
    [0.006, 0.095], [0.026, 0.11], [0.039, 0.135], [0.041, 0.16], [0.037, 0.19], [0.033, 0.215]], 14), { p: [x, y, z], s: [s, s, s] });
  const tumbler = (x, y, z) => T(lathe([[0, 0], [0.032, 0], [0.034, 0.004], [0.038, 0.1], [0.036, 0.1], [0.031, 0.008], [0, 0.008]], 16), { p: [x, y, z] });
  const bowl = (x, y, z, r = 0.075, h = 0.05) => T(lathe([[0, 0], [r * 0.45, 0], [r * 0.5, 0.004], [r * 0.85, h * 0.45], [r, h], [r - 0.004, h],
    [r * 0.82, h * 0.5], [r * 0.45, 0.008], [0, 0.008]], 20), { p: [x, y, z] });
  const plate = (x, y, z, r = 0.12) => T(lathe([[0, 0], [r * 0.6, 0], [r * 0.65, 0.006], [r, 0.018], [r - 0.004, 0.02], [r * 0.6, 0.011], [0, 0.011]], 24), { p: [x, y, z] });
  const cup = (x, y, z, ry = 0) => {
    const g = lathe([[0, 0], [0.03, 0], [0.033, 0.006], [0.04, 0.085], [0.037, 0.085], [0.03, 0.01], [0, 0.01]], 16);
    const h = new THREE.TorusGeometry(0.022, 0.005, 6, 12, Math.PI * 1.2); h.rotateZ(-Math.PI * 0.6); h.translate(0.042, 0.045, 0);
    return T(mergeGeometries([g.toNonIndexed(), h.toNonIndexed()]), { p: [x, y, z], r: [0, ry, 0] });
  };

  // tall glass cabinet at the end of the left run (glass faces +X, side clad in slats faces +Z)
  glassCabinet(G_CAB, {
    W: 0.65, D: 0.62, H: 2.45, doors: 1, plinth: 0.1, origin: [-1.88, 0, 1.0], ry: Math.PI / 2,
    shelves: [0.46, 0.84, 1.22, 1.6, 1.98],
    fill: (P) => {
      const zs = [0.09, 0.2, 0.31, 0.42, 0.53];
      // bottom: stacked bowls
      for (const x of [0.16, 0.42]) for (let k = 0; k < 4; k++) P(M.Ceramic_White, bowl(x, 0.12 + k * 0.035, -0.32, 0.085, 0.045));
      // shelf 1: bowls + plates
      for (const x of [0.15, 0.48]) for (let k = 0; k < 3; k++) P(M.Ceramic_White, bowl(x, 0.46 + k * 0.035, -0.3, 0.08, 0.045));
      for (let k = 0; k < 6; k++) P(M.Ceramic_White, plate(0.31, 0.46 + k * 0.013, -0.42, 0.11));
      // shelf 2: tumblers
      for (const x of zs) { P(M.Glass_Clear, tumbler(x, 0.84, -0.18)); P(M.Glass_Clear, tumbler(x + 0.045, 0.84, -0.4)); }
      // shelves 3-5 + top: wine glasses
      for (const y of [1.22, 1.6, 1.98]) for (const x of zs) {
        P(M.Glass_Clear, wineGlass(x, y, -0.17)); P(M.Glass_Clear, wineGlass(x + 0.045, y, -0.38));
      }
    },
  });
  // walnut slat cladding on the exposed side of the tall glass cabinet
  add(G_CAB, M.Matte_Black, box(-2.62, -1.868, 0, 2.45, 1.0, 1.008));
  for (let x = -2.6; x < -1.885; x += 0.04) add(G_CAB, M.Walnut, rbox(x, x + 0.025, 0.004, 2.446, 1.008, 1.03, 0.003, 1));

  // upper glass cabinet on the back wall
  glassCabinet(G_CAB, {
    W: 0.75, D: 0.33, H: 1.0, doors: 2, origin: [0.45, 1.45, -2.17], ry: 0,
    shelves: [0.34, 0.67],
    fill: (P) => {
      for (const x of [0.1, 0.2, 0.3]) P(M.Ceramic_White, cup(x, 0.02, -0.15, 0.3));
      for (let k = 0; k < 5; k++) P(M.Ceramic_White, plate(0.56, 0.02 + k * 0.013, -0.17, 0.11));
      for (const x of [0.1, 0.27]) for (let k = 0; k < 3; k++) P(M.Ceramic_White, bowl(x, 0.34 + k * 0.032, -0.17, 0.075, 0.042));
      P(M.Ceramic_White, cup(0.42, 0.34, -0.15, -0.4)); P(M.Ceramic_White, cup(0.52, 0.34, -0.17, 0.2));
      for (const x of [0.12, 0.24, 0.5, 0.62]) P(M.Glass_Clear, tumbler(x, 0.67, -0.16));
    },
  });

  // =============== ISLAND
  const G_IS = 'Island';
  const IX0 = -0.55, IX1 = 0.55, IZ0 = -0.9, IZ1 = 1.5, BODY_X1 = 0.22;
  const SINK = [-0.4, 0.02, 0.62, 1.12];
  {
    const s = rrShape(IX0, IX1, IZ0, IZ1, 0.006);
    const h = rrShape(SINK[0], SINK[1], SINK[2], SINK[3], 0.03);
    s.holes.push(h);
    add(G_IS, M.Marble_Counter, slab(s, 0.88, 0.94, 0.003, 12));
    add(G_IS, M.Marble_Counter, rbox(IX0, IX1, 0, 0.885, IZ1 - 0.06, IZ1, 0.003)); // waterfall
  }
  // body + fronts on the working side (-X)
  add(G_IS, M.Cabinet_Carcass, box(-0.52, BODY_X1, 0.08, 0.88, IZ0 + 0.03, IZ1 - 0.06));
  add(G_IS, M.Matte_Black, box(-0.46, 0.16, 0, 0.08, IZ0 + 0.08, IZ1 - 0.1));
  add(G_IS, M.Matte_Black, box(-0.526, -0.52, 0.8, 0.88, IZ0 + 0.03, IZ1 - 0.06));
  for (const [z0, z1] of [[IZ0 + 0.03, -0.1], [-0.1, 0.55]]) {
    add(G_IS, M.Cabinet_Taupe, box(-0.539, -0.52, 0.08 + GAP, 0.44 - GAP, z0 + GAP, z1 - GAP));
    add(G_IS, M.Cabinet_Taupe, box(-0.539, -0.52, 0.44 + GAP, 0.8 - GAP, z0 + GAP, z1 - GAP));
  }
  add(G_IS, M.Cabinet_Taupe, box(-0.539, -0.52, 0.08 + GAP, 0.8 - GAP, 0.55 + GAP, IZ1 - 0.06 - GAP));
  add(G_IS, M.Cabinet_Taupe, box(-0.52, BODY_X1 + 0.03, 0.08, 0.88, IZ0, IZ0 + 0.03)); // end panel
  // walnut slats under the seating overhang (+X)
  add(G_IS, M.Matte_Black, box(BODY_X1, BODY_X1 + 0.006, 0.08, 0.88, IZ0 + 0.03, IZ1 - 0.06));
  for (let z = IZ0 + 0.045; z < IZ1 - 0.08; z += 0.04) add(G_IS, M.Walnut, rbox(BODY_X1 + 0.006, BODY_X1 + 0.028, 0.082, 0.878, z, z + 0.025, 0.003, 1));
  // LEDs: plinth glow + overhang strip
  add(G_IS, M.LED_Warm, box(-0.52, -0.505, 0.074, 0.08, IZ0 + 0.04, IZ1 - 0.07));
  add(G_IS, M.LED_Warm, box(BODY_X1 + 0.012, BODY_X1 + 0.028, 0.074, 0.08, IZ0 + 0.04, IZ1 - 0.07));
  add(G_IS, M.LED_Warm, box(-0.5, BODY_X1, 0.074, 0.08, IZ0 + 0.03, IZ0 + 0.045));
  add(G_IS, M.LED_Warm, box(IX0 + 0.01, IX1 - 0.01, 0.0, 0.006, IZ1 + 0.0, IZ1 + 0.012));
  add(G_IS, M.LED_Warm, box(IX1 - 0.04, IX1 - 0.025, 0.872, 0.88, IZ0 + 0.02, IZ1 - 0.07));
  {
    // floor glow decal under the island
    const pad = 0.55, w = (IX1 - IX0) + pad * 2, d = (IZ1 - IZ0) + pad * 2;
    const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
    g.translate((IX0 + IX1) / 2, 0.002, (IZ0 + IZ1) / 2);
    add(G_IS, M.Glow_Floor, g);
  }
  // sink basin
  {
    const [x0, x1, z0, z1] = SINK; const yb = 0.7, t = 0.008;
    add(G_IS, M.Sink_Graphite, box(x0, x1, yb, yb + t, z0, z1));
    add(G_IS, M.Sink_Graphite, box(x0, x0 + t, yb, 0.88, z0, z1));
    add(G_IS, M.Sink_Graphite, box(x1 - t, x1, yb, 0.88, z0, z1));
    add(G_IS, M.Sink_Graphite, box(x0, x1, yb, 0.88, z0, z0 + t));
    add(G_IS, M.Sink_Graphite, box(x0, x1, yb, 0.88, z1 - t, z1));
    add(G_IS, M.Metal_Black, T(cyl(0.035, 0.004, 20), { p: [(x0 + x1) / 2, yb + t, (z0 + z1) / 2] }));
  }
  // faucet (matte black gooseneck)
  {
    const fx = -0.47, fz = 0.87, fy = 0.94;
    add(G_IS, M.Metal_Black, T(cyl(0.026, 0.045, 20, 0.022), { p: [fx, fy, fz] }));
    const c = new THREE.CatmullRomCurve3([
      new V3(0, 0.03, 0), new V3(0, 0.2, 0), new V3(0, 0.31, 0), new V3(0.04, 0.37, 0),
      new V3(0.12, 0.385, 0), new V3(0.19, 0.35, 0), new V3(0.215, 0.29, 0), new V3(0.218, 0.25, 0),
    ]);
    add(G_IS, M.Metal_Black, T(new THREE.TubeGeometry(c, 48, 0.0135, 12), { p: [fx, fy, fz] }));
    add(G_IS, M.Metal_Black, T(cyl(0.017, 0.05, 16), { p: [fx + 0.218, fy + 0.2, fz] }));
    add(G_IS, M.Metal_Black, rod([fx, fy + 0.12, fz], [fx, fy + 0.12, fz - 0.05], 0.011, 12));
    add(G_IS, M.Metal_Black, rod([fx, fy + 0.12, fz - 0.05], [fx + 0.06, fy + 0.15, fz - 0.06], 0.005, 8));
    // second tap / soap
    add(G_IS, M.Metal_Black, T(lathe([[0, 0], [0.018, 0], [0.018, 0.13], [0.008, 0.14], [0.004, 0.165], [0.0, 0.165]], 14), { p: [fx + 0.02, fy, fz - 0.17] }));
  }
  // fruit bowl with green apples
  {
    const bx = 0.12, bz = -0.45, by = 0.94;
    add(G_IS, M.Ceramic_Charcoal, T(lathe([[0, 0], [0.07, 0], [0.075, 0.005], [0.15, 0.055], [0.17, 0.075], [0.164, 0.077], [0.142, 0.058], [0.07, 0.012], [0, 0.012]], 32), { p: [bx, by, bz] }));
    seed(42);
    const apples = [[0, 0.05, 0], [0.065, 0.045, 0.03], [-0.06, 0.045, 0.035], [0.02, 0.045, -0.07], [-0.04, 0.05, -0.05], [0.07, 0.05, -0.045], [0.0, 0.11, 0.0]];
    for (const [ax, ay, az] of apples) {
      const g = new THREE.SphereGeometry(0.04, 16, 12);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); const dimple = Math.exp(-((0.04 - Math.abs(y)) ** 2) / 0.00006) * 0.006 * Math.sign(y); p.setY(i, y * 0.92 - dimple); }
      g.computeVertexNormals();
      add(G_IS, M.Apple_Green, T(g, { p: [bx + ax, by + ay, bz + az], r: [rr(-0.3, 0.3), rr(0, 6), rr(-0.3, 0.3)] }));
      add(G_IS, M.Branch, rod([bx + ax, by + ay + 0.03, bz + az], [bx + ax + 0.004, by + ay + 0.052, bz + az + 0.003], 0.0025, 5));
    }
  }
  // glass vase with flowering branches
  {
    const vx = 0.02, vz = 0.12, vy = 0.94;
    add(G_IS, M.Glass_Clear, T(lathe([[0, 0], [0.05, 0], [0.065, 0.06], [0.07, 0.12], [0.06, 0.2], [0.045, 0.25], [0.048, 0.27]], 20), { p: [vx, vy, vz] }));
    seed(99);
    const blossom = (p, r) => add(G_IS, M.Blossom, T(new THREE.IcosahedronGeometry(r, 0), { p: [p.x, p.y, p.z], r: [rr(0, 3), rr(0, 3), 0] }));
    const branches = [];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4 + rr(-0.3, 0.3), lean = rr(0.15, 0.55), h = rr(0.35, 0.62);
      const base = new V3(vx + Math.cos(a) * 0.01, vy + 0.05, vz + Math.sin(a) * 0.01);
      const mid = base.clone().add(new V3(Math.cos(a) * lean * 0.25, h * 0.55, Math.sin(a) * lean * 0.25));
      const tip = base.clone().add(new V3(Math.cos(a) * lean * 0.6 + rr(-0.05, 0.05), h, Math.sin(a) * lean * 0.6 + rr(-0.05, 0.05)));
      branches.push(new THREE.QuadraticBezierCurve3(base, mid, tip));
      // a side twig
      const sp = branches[branches.length - 1].getPoint(rr(0.55, 0.75));
      const st = sp.clone().add(new V3(Math.cos(a + 0.8) * 0.12, rr(0.06, 0.14), Math.sin(a + 0.8) * 0.12));
      branches.push(new THREE.QuadraticBezierCurve3(sp, sp.clone().lerp(st, 0.5).add(new V3(0, 0.02, 0)), st));
    }
    for (const c of branches) {
      add(G_IS, M.Branch, new THREE.TubeGeometry(c, 10, 0.0032, 5));
      for (let t = 0.45; t <= 1.0; t += 0.07) {
        const p = c.getPoint(t);
        const n = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < n; k++) blossom(p.clone().add(new V3(rr(-0.022, 0.022), rr(-0.015, 0.02), rr(-0.022, 0.022))), rr(0.009, 0.016));
      }
    }
  }

  // =============== STOOLS
  const stool = (name, sx, sz, ry) => {
    const parts = [];
    const P = (m, g) => parts.push([m, g]);
    const SY = 0.66;
    P(M.Upholstery_Cream, rbox(-0.21, 0.21, SY, SY + 0.075, -0.2, 0.2, 0.032, 3));
    // curved backrest (annular sector, upholstered)
    const sh = new THREE.Shape();
    const ri = 0.19, ro = 0.235, a0 = -1.15, a1 = 1.15;
    sh.absarc(0, 0, ro, a0, a1, false); sh.absarc(0, 0, ri, a1, a0, true); sh.closePath();
    const back = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.018, bevelSegments: 3, curveSegments: 24 });
    back.rotateX(-Math.PI / 2); back.translate(-0.06, SY + 0.12, 0);
    P(M.Upholstery_Cream, back);
    for (const az of [-0.11, 0.11]) P(M.Matte_Black, rod([0.13, SY + 0.07, az], [0.14, SY + 0.125, az], 0.007, 6));
    // frame
    const top = [[0.16, 0.15], [-0.16, 0.15], [-0.16, -0.15], [0.16, -0.15]];
    const bot = top.map(([x, z]) => [x * 1.35, z * 1.35]);
    for (let i = 0; i < 4; i++) {
      P(M.Matte_Black, rod([bot[i][0], 0, bot[i][1]], [top[i][0], SY, top[i][1]], 0.0095, 8));
      const j = (i + 1) % 4;
      const lerp = (a, b, t) => a + (b - a) * t;
      const t = 0.28 / SY; // footrest height
      const p1 = [lerp(bot[i][0], top[i][0], t), 0.28, lerp(bot[i][1], top[i][1], t)];
      const p2 = [lerp(bot[j][0], top[j][0], t), 0.28, lerp(bot[j][1], top[j][1], t)];
      P(M.Matte_Black, rod(p1, p2, 0.008, 8));
      P(M.Matte_Black, rod([top[i][0], SY - 0.005, top[i][1]], [top[j][0], SY - 0.005, top[j][1]], 0.008, 6));
    }
    for (const [m, g] of parts) add(name, m, T(g, { p: [sx, 0, sz], r: [0, ry, 0] }));
  };
  stool('Stool_A', 0.78, 0.4, 0.06);
  stool('Stool_B', 0.78, -0.35, -0.05);

  // =============== PENDANT RINGS
  const pendant = (name, cx, cy, cz, R) => {
    const ann = new THREE.Shape(); ann.absarc(cx, -cz, R, 0, TAU, false);
    const hole = new THREE.Path(); hole.absarc(cx, -cz, R - 0.05, 0, TAU, true); ann.holes.push(hole);
    add(name, M.Metal_Black, slab(ann, cy, cy + 0.038, 0.006, 64));
    const led = new THREE.RingGeometry(R - 0.043, R - 0.007, 96, 1); led.rotateX(Math.PI / 2); led.translate(cx, cy - 0.0008, cz);
    add(name, M.LED_Warm, led);
    const band = new THREE.TorusGeometry(R - 0.05, 0.011, 8, 96); band.rotateX(Math.PI / 2); band.scale(1, 1.4, 1); band.translate(cx, cy + 0.019, cz);
    add(name, M.LED_Warm, band);
    const hub = [cx, cy + 0.5, cz];
    add(name, M.Metal_Black, T(cyl(0.012, 0.05, 12), { p: [cx, cy + 0.48, cz] }));
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3 + 0.4;
      add(name, M.Metal_Black, rod(hub, [cx + Math.cos(a) * (R - 0.025), cy + 0.038, cz + Math.sin(a) * (R - 0.025)], 0.0015, 4));
    }
    add(name, M.Metal_Black, rod([cx, cy + 0.53, cz], [cx, 2.7, cz], 0.0025, 6));
    add(name, M.Metal_Black, T(cyl(0.06, 0.018, 24, 0.055), { p: [cx, 2.682, cz] }));
  };
  pendant('Pendant_A', 0.0, 1.96, 0.9, 0.32);
  pendant('Pendant_B', 0.0, 2.14, -0.15, 0.4);

  // =============== PLANTS
  const G_PL = 'Plants';
  const leafMats = [M.Leaf_Green, M.Leaf_Dark, M.Leaf_Green, M.Leaf_Light];
  const pot = (x, y, z, r, h, group = G_PL) => {
    add(group, M.Pot_Stone, T(lathe([[0, 0], [r * 0.78, 0], [r * 0.8, 0.01], [r * 0.97, h * 0.93], [r, h], [r * 0.93, h], [r * 0.9, h * 0.9], [0, h * 0.9]], 28), { p: [x, y, z] }));
    add(group, M.Soil, T(cyl(r * 0.9, 0.004, 20), { p: [x, y + h * 0.9 - 0.012, z] }));
    return y + h * 0.9 - 0.01;
  };
  const bigPlant = (x, z, s, sd) => {
    seed(sd);
    const soil = pot(x, 0, z, 0.21, 0.46);
    const n = 13;
    for (let k = 0; k < n; k++) {
      const a = k * 2.39996 + rr(-0.25, 0.25), tilt = rr(0.06, 0.55), L = rr(0.45, 1.0) * s;
      const base = new V3(x + Math.cos(a) * 0.035, soil, z + Math.sin(a) * 0.035);
      const dir = new V3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
      const tip = base.clone().addScaledVector(dir, L);
      const mid = base.clone().addScaledVector(dir, L * 0.5).add(new V3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04));
      add(G_PL, M.Stem, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(base, mid, tip), 6, 0.0075, 5));
      const lt = tilt + rr(0.25, 0.5);
      const ldir = new V3(Math.sin(lt) * Math.cos(a), Math.cos(lt), Math.sin(lt) * Math.sin(a));
      const g = leafGeom(rr(0.42, 0.6) * s, rr(0.17, 0.25) * s, { shape: 'oblong', fold: 0.38, droop: rr(0.12, 0.3), twist: rr(-0.3, 0.3), segL: 12, segW: 3 });
      add(G_PL, leafMats[k % 4], orient(g, tip, ldir, rr(-0.35, 0.35)));
    }
  };
  bigPlant(-3.02, 1.75, 1.0, 7);
  bigPlant(3.17, -1.25, 1.05, 21);

  const rosette = (x, y, z, n, len, wid, sd, shape = 'lance', spread = [0.3, 1.1]) => {
    seed(sd);
    for (let k = 0; k < n; k++) {
      const a = k * 2.39996 + rr(-0.2, 0.2), tilt = rr(spread[0], spread[1]);
      const dir = new V3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
      const base = new V3(x + Math.cos(a) * 0.01, y, z + Math.sin(a) * 0.01);
      const g = leafGeom(len * rr(0.75, 1.15), wid * rr(0.8, 1.1), { shape, fold: 0.3, droop: rr(0.2, 0.45), segL: 7, segW: 2 });
      add(G_PL, leafMats[k % 4], orient(g, base, dir, rr(-0.3, 0.3)));
    }
  };
  // niche plants
  {
    // niche A: trailing pothos
    const nz = 0.05, soil = pot(-2.33, 2.068, nz, 0.075, 0.1);
    rosette(-2.33, soil, nz, 16, 0.085, 0.07, 3, 'heart', [0.4, 1.3]);
    seed(17);
    for (let v = 0; v < 6; v++) {
      const z0 = nz + rr(-0.06, 0.06), dz = rr(-0.22, 0.22), yEnd = rr(1.25, 1.85);
      const pts = [
        new V3(-2.3, soil + 0.02, z0), new V3(-2.2, 2.12, z0 + dz * 0.12), new V3(-2.14, 2.1, z0 + dz * 0.25), new V3(-2.115, 2.0, z0 + dz * 0.4),
        new V3(-2.118 + rr(0, 0.02), (2.0 + yEnd) / 2, z0 + dz * 0.7), new V3(-2.11 + rr(0, 0.04), yEnd, z0 + dz),
      ];
      const c = new THREE.CatmullRomCurve3(pts);
      add(G_PL, M.Stem, new THREE.TubeGeometry(c, 24, 0.0025, 4));
      const len = c.getLength();
      for (let d = 0.05; d < len; d += rr(0.035, 0.055)) {
        const t = d / len; const p = c.getPointAt(t);
        const dir = new V3(rr(0.7, 1.3), rr(-0.9, 0.2), rr(-0.9, 0.9)).normalize();
        const sz = 1 - t * 0.35;
        const g = leafGeom(rr(0.06, 0.085) * sz, rr(0.05, 0.065) * sz, { shape: 'heart', fold: 0.25, droop: 0.35, segL: 6, segW: 2 });
        add(G_PL, leafMats[Math.floor(rand() * 4)], orient(g, p.add(new V3(0.006, 0, 0)), dir, rr(-0.5, 0.5)));
      }
    }
    // niches B & C: compact plants
    rosette(-2.33, pot(-2.33, 2.068, -0.55, 0.065, 0.09), -0.55, 14, 0.12, 0.05, 31, 'lance', [0.1, 0.9]);
    rosette(-2.33, pot(-2.33, 2.068, -1.15, 0.065, 0.09), -1.15, 18, 0.09, 0.07, 37, 'heart', [0.2, 1.1]);
    // counter plant (left run, near the corner)
    rosette(-2.25, pot(-2.25, 0.9, -1.55, 0.08, 0.11), -1.55, 22, 0.11, 0.085, 43, 'heart', [0.15, 1.2]);
    // small plant inside the back glass cabinet
    rosette(1.09, pot(1.09, 1.45 + 0.34, -2.32, 0.045, 0.07), -2.32, 12, 0.07, 0.05, 51, 'heart', [0.2, 1.0]);
  }

  // =============== COUNTER DECOR
  const G_DEC = 'Decor';
  {
    // leaning cutting boards
    const board = (len, wid, handle) => {
      const s = new THREE.Shape(); const r = 0.03;
      s.moveTo(-wid / 2 + r, 0); s.lineTo(wid / 2 - r, 0); s.quadraticCurveTo(wid / 2, 0, wid / 2, r);
      s.lineTo(wid / 2, len - r); s.quadraticCurveTo(wid / 2, len, wid / 2 - r, len);
      s.lineTo(handle / 2, len); s.lineTo(handle / 2, len + 0.09); s.absarc(0, len + 0.09, handle / 2, 0, Math.PI, false);
      s.lineTo(-handle / 2, len); s.lineTo(-wid / 2 + r, len); s.quadraticCurveTo(-wid / 2, len, -wid / 2, len - r);
      s.lineTo(-wid / 2, r); s.quadraticCurveTo(-wid / 2, 0, -wid / 2 + r, 0);
      const hole = new THREE.Path(); hole.absarc(0, len + 0.09, 0.009, 0, TAU, true); s.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 12 });
      return g;
    };
    // boards stand on the counter, faces toward +X, leaning back against the backsplash
    add(G_DEC, M.Wood_Board, T(board(0.34, 0.22, 0.05).rotateX(-0.13), { p: [-2.44, 0.9, -0.05], r: [0, Math.PI / 2, 0] }));
    add(G_DEC, M.Wood_Board, T(board(0.27, 0.19, 0.045).rotateX(-0.2), { p: [-2.405, 0.9, 0.12], r: [0, Math.PI / 2, 0] }));
    // grinders
    for (const [x, z] of [[-2.3, 0.26], [-2.24, 0.22]]) add(G_DEC, M.Matte_Black, T(lathe([[0, 0], [0.024, 0], [0.024, 0.12], [0.02, 0.135], [0.008, 0.15], [0.0, 0.152]], 16), { p: [x, 0.9, z] }));
    // utensil crock + utensils, canisters on the back counter
    add(G_DEC, M.Ceramic_White, T(lathe([[0, 0], [0.055, 0], [0.058, 0.15], [0.054, 0.15], [0.05, 0.012], [0, 0.012]], 24), { p: [0.75, 0.9, -2.3] }));
    seed(5);
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3, b = [0.75 + Math.cos(a) * 0.02, 0.92, -2.3 + Math.sin(a) * 0.02];
      const t = [b[0] + rr(-0.06, 0.06), 1.2 + rr(0, 0.08), b[2] + rr(-0.05, 0.05)];
      add(G_DEC, k % 2 ? M.Wood_Board : M.Matte_Black, rod(b, t, 0.007, 6));
      add(G_DEC, k % 2 ? M.Wood_Board : M.Matte_Black, T(new THREE.SphereGeometry(0.022, 10, 6), { p: t, s: [1, 1.5, 0.45] }));
    }
    add(G_DEC, M.Ceramic_White, T(lathe([[0, 0], [0.05, 0], [0.05, 0.2], [0.046, 0.205], [0.0, 0.205]], 24), { p: [0.92, 0.9, -2.33] }));
    add(G_DEC, M.Wood_Board, T(cyl(0.05, 0.02, 24), { p: [0.92, 1.105, -2.33] }));
    add(G_DEC, M.Ceramic_White, T(lathe([[0, 0], [0.042, 0], [0.042, 0.15], [0.038, 0.155], [0.0, 0.155]], 24), { p: [1.05, 0.9, -2.3] }));
    add(G_DEC, M.Wood_Board, T(cyl(0.042, 0.02, 24), { p: [1.05, 1.055, -2.3] }));
    // a bowl + ceramic on the left counter near the cooktop corner
    add(G_DEC, M.Ceramic_Charcoal, bowl(-1.6, 0.9, -2.25, 0.11, 0.06));
  }

  // backsplash light wash decals
  {
    const gL = new THREE.PlaneGeometry(2.5, 0.55); gL.rotateY(Math.PI / 2); gL.translate(-2.4865, 1.175, -0.9);
    add('Lighting_FX', M.Glow_Wash, gL);
    const gB = new THREE.PlaneGeometry(3.3, 0.55); gB.translate(-0.5, 1.175, -2.4865);
    add('Lighting_FX', M.Glow_Wash, gB);
  }

  // ---------------------------------------------------------------- finalize
  const root = new THREE.Group(); root.name = 'Kitchen';
  const groups = new Map();
  let tris = 0, verts = 0;
  for (const { group, m, geoms } of buckets.values()) {
    let merged = mergeGeometries(geoms, false);
    merged = mergeVertices(merged, 1e-5);
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, m);
    mesh.name = `${group}__${m.name}`;
    const isFx = m.name.startsWith('Glow_') || m.name === 'LED_Warm' || m.name.startsWith('Glass') || m.name === 'Display_Glow';
    mesh.userData = { castShadow: !isFx, receiveShadow: !m.name.startsWith('Glow_') && m.name !== 'LED_Warm' };
    if (!groups.has(group)) { const g = new THREE.Group(); g.name = group; groups.set(group, g); root.add(g); }
    groups.get(group).add(mesh);
    tris += merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3;
    verts += merged.attributes.position.count;
  }

  // light anchors: empty nodes the website can attach real lights to
  const anchors = new THREE.Group(); anchors.name = 'LightAnchors'; root.add(anchors);
  for (const [n, p] of [
    ['Anchor_Pendant_A', [0, 1.9, 0.9]], ['Anchor_Pendant_B', [0, 2.08, -0.15]],
    ['Anchor_GlassCabinet', [-2.2, 1.4, 0.68]], ['Anchor_UnderCabinet_Left', [-2.25, 1.35, -1.0]],
    ['Anchor_UnderCabinet_Back', [-0.5, 1.35, -2.25]], ['Anchor_Cove', [1.2, 2.6, 0.2]],
  ]) { const o = new THREE.Object3D(); o.name = n; o.position.set(...p); anchors.add(o); }

  const cam = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 60);
  cam.name = 'HeroCamera';
  cam.position.set(5.9, 2.55, 8.4); cam.lookAt(-0.2, 1.15, -0.6);
  root.add(cam);

  root.userData.stats = { meshes: buckets.size, triangles: tris, vertices: verts };
  return root;
}
