import * as THREE from 'three';

// Geometry helpers for building the phone body procedurally.
//
// Outlines are closed loops of { x, y, nx, ny } (position + outward normal),
// wound counter-clockwise. Corners are superellipse quadrants, which gives the
// continuous-curvature corners Apple uses instead of plain circular fillets.

const EXP = 2.7; // superellipse exponent; 2 = circle, higher = squarer

function cornerPoints(cx, cy, r, t0, segments, exponent) {
  const pts = [];
  const e = 2 / exponent;
  for (let i = 0; i <= segments; i++) {
    const t = t0 + (i / segments) * (Math.PI / 2);
    const c = Math.cos(t);
    const s = Math.sin(t);
    const ux = Math.sign(c) * Math.pow(Math.abs(c), e);
    const uy = Math.sign(s) * Math.pow(Math.abs(s), e);
    // Gradient of |x|^n + |y|^n gives the outward normal.
    let nx = Math.sign(ux) * Math.pow(Math.abs(ux), exponent - 1);
    let ny = Math.sign(uy) * Math.pow(Math.abs(uy), exponent - 1);
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    pts.push({ x: cx + r * ux, y: cy + r * uy, nx, ny });
  }
  return pts;
}

function edgePoints(a, b, nx, ny, count) {
  const pts = [];
  for (let i = 1; i < count; i++) {
    const k = i / count;
    pts.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, nx, ny });
  }
  return pts;
}

/**
 * Rounded rectangle centred on (cx, cy).
 * rTop / rBottom are the corner radii of the top and bottom corners.
 */
export function roundedRect(w, h, rTop, rBottom = rTop, { cx = 0, cy = 0, segments = 28, exponent = EXP, edgeSteps = 6 } = {}) {
  const hw = w / 2;
  const hh = h / 2;
  const tr = cornerPoints(cx + hw - rTop, cy + hh - rTop, rTop, 0, segments, exponent);
  const tl = cornerPoints(cx - hw + rTop, cy + hh - rTop, rTop, Math.PI / 2, segments, exponent);
  const bl = cornerPoints(cx - hw + rBottom, cy - hh + rBottom, rBottom, Math.PI, segments, exponent);
  const br = cornerPoints(cx + hw - rBottom, cy - hh + rBottom, rBottom, Math.PI * 1.5, segments, exponent);
  const out = [];
  const push = (arr) => arr.forEach((p) => out.push(p));
  push(tr);
  push(edgePoints(tr[tr.length - 1], tl[0], 0, 1, edgeSteps));
  push(tl);
  push(edgePoints(tl[tl.length - 1], bl[0], -1, 0, edgeSteps * 2));
  push(bl);
  push(edgePoints(bl[bl.length - 1], br[0], 0, -1, edgeSteps));
  push(br);
  push(edgePoints(br[br.length - 1], tr[0], 1, 0, edgeSteps * 2));
  return out;
}

export function insetOutline(outline, d) {
  return outline.map((p) => ({ x: p.x - p.nx * d, y: p.y - p.ny * d, nx: p.nx, ny: p.ny }));
}

/**
 * Sweeps a cross-section profile around an outline.
 * profile: [{ o: inset, z, nr: outward normal component, nz }]
 */
export function sweepProfile(outline, profile) {
  const n = outline.length;
  const m = profile.length;
  const pos = new Float32Array(n * m * 3);
  const nor = new Float32Array(n * m * 3);
  const uv = new Float32Array(n * m * 2);
  // Arc length for u so textures don't stretch around corners.
  const lens = [0];
  for (let i = 1; i < n; i++) lens.push(lens[i - 1] + Math.hypot(outline[i].x - outline[i - 1].x, outline[i].y - outline[i - 1].y));
  const total = lens[n - 1] + Math.hypot(outline[0].x - outline[n - 1].x, outline[0].y - outline[n - 1].y);
  for (let k = 0; k < m; k++) {
    const pr = profile[k];
    for (let i = 0; i < n; i++) {
      const p = outline[i];
      const idx = k * n + i;
      pos[idx * 3] = p.x - p.nx * pr.o;
      pos[idx * 3 + 1] = p.y - p.ny * pr.o;
      pos[idx * 3 + 2] = pr.z;
      const vx = p.nx * pr.nr;
      const vy = p.ny * pr.nr;
      const l = Math.hypot(vx, vy, pr.nz) || 1;
      nor[idx * 3] = vx / l;
      nor[idx * 3 + 1] = vy / l;
      nor[idx * 3 + 2] = pr.nz / l;
      uv[idx * 2] = lens[i] / total;
      uv[idx * 2 + 1] = k / (m - 1);
    }
  }
  const index = [];
  for (let k = 0; k < m - 1; k++) {
    for (let i = 0; i < n; i++) {
      const a = k * n + i;
      const b = k * n + ((i + 1) % n);
      const c = (k + 1) * n + i;
      const d = (k + 1) * n + ((i + 1) % n);
      // Profiles run front (+z) to back (-z); this winding faces outward.
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/** Flat cap filling an outline at height z, facing +z (facing = 1) or -z (facing = -1). */
export function capGeometry(outline, z, facing = 1) {
  const n = outline.length;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, cx = 0, cy = 0;
  for (const p of outline) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    cx += p.x; cy += p.y;
  }
  cx /= n; cy /= n;
  const pos = new Float32Array((n + 1) * 3);
  const nor = new Float32Array((n + 1) * 3);
  const uv = new Float32Array((n + 1) * 2);
  const put = (i, x, y) => {
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    nor[i * 3 + 2] = facing;
    uv[i * 2] = (x - minX) / (maxX - minX);
    uv[i * 2 + 1] = (y - minY) / (maxY - minY);
  };
  put(0, cx, cy);
  outline.forEach((p, i) => put(i + 1, p.x, p.y));
  const index = [];
  for (let i = 0; i < n; i++) {
    const a = i + 1;
    const b = ((i + 1) % n) + 1;
    if (facing > 0) index.push(0, a, b);
    else index.push(0, b, a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/** Quarter-ellipse arc from a vertical wall into a flat face. */
export function arcProfile({ fromWall, zWall, zFace, r, steps = 10, facing }) {
  // facing = +1 rounds into a +z face, -1 into a -z face.
  const out = [];
  const rz = Math.abs(zFace - zWall);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    const o = r * (1 - Math.cos(a));
    const z = zWall + facing * rz * Math.sin(a);
    out.push({ o: o + fromWall, z, nr: Math.cos(a) / r, nz: (facing * Math.sin(a)) / rz });
  }
  return out;
}

/** A rounded slab (puck) along +z: outline swept with rounded top edge, plus top cap. */
export function slab(outline, { z0 = 0, height, radius, steps = 8 }) {
  const r = Math.min(radius, height);
  const profile = [
    { o: 0, z: z0, nr: 1, nz: 0 },
    ...arcProfile({ fromWall: 0, zWall: z0 + height - r, zFace: z0 + height, r, steps, facing: 1 }),
  ];
  // sweepProfile expects front-to-back ordering for outward winding.
  profile.reverse();
  const side = sweepProfile(outline, profile);
  const cap = capGeometry(insetOutline(outline, r), z0 + height, 1);
  return { side, cap };
}

export function circleOutline(r, segments = 96) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push({ x: Math.cos(t) * r, y: Math.sin(t) * r, nx: Math.cos(t), ny: Math.sin(t) });
  }
  return pts;
}
