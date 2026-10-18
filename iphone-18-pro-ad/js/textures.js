import * as THREE from 'three';

// Procedural textures. Everything is drawn into canvases so the film has no
// external image dependencies and renders identically everywhere.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Deterministic PRNG so every render of the film is identical.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fine bead-blast grain for anodized aluminium (used as a bump map). */
export function grainTexture(size = 512) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const r = rng(7);
  for (let i = 0; i < size * size; i++) {
    const v = 110 + r() * 36;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
}

/** True Tone flash: frosted Fresnel rings. */
export function flashTexture() {
  const s = 256;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, '#fbf6e9');
  g.addColorStop(0.7, '#e9e2d0');
  g.addColorStop(1, '#bdb6a5');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(120,110,90,0.28)';
  for (let r = 6; r < s / 2; r += 7) {
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const FONT = '"SF Pro Display", "SF Pro", -apple-system, "InterAd", system-ui, sans-serif';
const FONT_ROUNDED = '"SF Pro Rounded", "SF Pro Display", -apple-system, "InterAd", system-ui, sans-serif';

/**
 * Lock Screen. 9:41, as always. Dynamic Island drawn to scale.
 * dims: display size in scene units, island: { w, h, top } in scene units.
 */
export function lockScreenTexture(dims, island) {
  const W = 1024;
  const H = Math.round((W * dims.h) / dims.w);
  const px = W / dims.w;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');

  // Wallpaper: deep burgundy light field.
  ctx.fillStyle = '#12030a';
  ctx.fillRect(0, 0, W, H);
  ctx.filter = 'blur(70px)';
  const blob = (x, y, r, col) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  blob(W * 0.15, H * 0.62, W * 0.9, 'rgba(128,18,48,0.95)');
  blob(W * 0.95, H * 0.42, W * 0.75, 'rgba(196,58,88,0.75)');
  blob(W * 0.55, H * 0.95, W * 0.9, 'rgba(70,8,34,0.95)');
  blob(W * 0.6, H * 0.18, W * 0.55, 'rgba(92,20,52,0.7)');
  blob(W * 0.3, H * 0.35, W * 0.35, 'rgba(255,140,150,0.25)');
  // Bright crown of light so the Dynamic Island reads against the wallpaper.
  blob(W * 0.5, -H * 0.02, W * 0.7, 'rgba(236,104,132,0.85)');
  blob(W * 0.5, H * 0.04, W * 0.35, 'rgba(255,190,200,0.55)');
  ctx.filter = 'none';
  // Soft sweeping ribbon of light.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = 'blur(24px)';
  ctx.strokeStyle = 'rgba(255,170,180,0.35)';
  ctx.lineWidth = 60;
  ctx.beginPath();
  ctx.moveTo(-100, H * 0.78);
  ctx.bezierCurveTo(W * 0.3, H * 0.55, W * 0.7, H * 0.92, W + 100, H * 0.6);
  ctx.stroke();
  ctx.restore();

  // Status bar (right side) – signal, Wi-Fi, battery.
  ctx.fillStyle = '#fff';
  const sy = island.top * px + (island.h * px) / 2;
  const sx = W - 70;
  // battery
  ctx.globalAlpha = 0.95;
  roundRect(ctx, sx - 52, sy - 15, 50, 30, 9);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.stroke();
  roundRect(ctx, sx - 47, sy - 10, 40, 20, 5);
  ctx.fill();
  roundRect(ctx, sx + 1, sy - 6, 4, 12, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
  // wifi
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  const wx = sx - 92;
  const wy = sy + 12;
  for (let i = 0; i < 3; i++) {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(wx, wy, 10 + i * 9, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(wx, wy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // signal
  for (let i = 0; i < 4; i++) {
    roundRect(ctx, sx - 160 + i * 11, sy + 12 - (8 + i * 6), 7, 8 + i * 6, 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Dynamic Island (smaller this year).
  const iw = island.w * px;
  const ih = island.h * px;
  const ix = W / 2 - iw / 2;
  const iy = island.top * px;
  roundRect(ctx, ix, iy, iw, ih, ih / 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  // Front camera, barely visible inside the island.
  const camX = ix + iw - ih / 2;
  const camY = iy + ih / 2;
  const cg = ctx.createRadialGradient(camX - 3, camY - 3, 1, camX, camY, ih * 0.26);
  cg.addColorStop(0, '#2a2d44');
  cg.addColorStop(0.5, '#0d0e18');
  cg.addColorStop(1, '#030305');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(camX, camY, ih * 0.26, 0, Math.PI * 2);
  ctx.fill();

  // Date + time.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,236,240,0.88)';
  ctx.font = `600 50px ${FONT}`;
  ctx.fillText('Friday, September 18', W / 2, H * 0.135);
  const tg = ctx.createLinearGradient(0, H * 0.15, 0, H * 0.3);
  tg.addColorStop(0, 'rgba(255,255,255,0.98)');
  tg.addColorStop(1, 'rgba(255,214,222,0.9)');
  ctx.fillStyle = tg;
  ctx.font = `700 330px ${FONT_ROUNDED}`;
  ctx.letterSpacing = '-6px';
  ctx.fillText('9:41', W / 2, H * 0.29);
  ctx.letterSpacing = '0px';

  // Quick actions.
  const by = H - 205;
  for (const bx of [150, W - 150]) {
    ctx.beginPath();
    ctx.arc(bx, by, 62, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,6,14,0.45)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.stroke();
  }
  // flashlight glyph
  ctx.fillStyle = '#fff';
  roundRect(ctx, 150 - 13, by - 28, 26, 16, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(150 - 13, by - 10);
  ctx.lineTo(150 + 13, by - 10);
  ctx.lineTo(150 + 8, by + 6);
  ctx.lineTo(150 + 8, by + 30);
  ctx.lineTo(150 - 8, by + 30);
  ctx.lineTo(150 - 8, by + 6);
  ctx.closePath();
  ctx.fill();
  // camera glyph
  const cx = W - 150;
  roundRect(ctx, cx - 30, by - 18, 60, 42, 9);
  ctx.fill();
  roundRect(ctx, cx - 12, by - 26, 24, 12, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,6,14,1)';
  ctx.beginPath();
  ctx.arc(cx, by + 3, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, by + 3, 8, 0, Math.PI * 2);
  ctx.fill();

  // Home indicator.
  roundRect(ctx, W / 2 - 140, H - 34, 280, 11, 5.5);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Circuit traces radiating from the chip. R = trace mask, G = pads. */
export function traceTexture(size = 2048) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const r = rng(42);
  const half = size / 2;
  const chip = size * 0.105; // half-size of chip footprint in px
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const sides = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  for (const [dx, dy] of sides) {
    const count = 34;
    for (let i = 0; i < count; i++) {
      const off = ((i + 0.5) / count - 0.5) * chip * 1.8;
      let x = half + dx * chip + (dy !== 0 ? off : 0);
      let y = half + dy * chip + (dx !== 0 ? off : 0);
      ctx.beginPath();
      ctx.moveTo(x, y);
      const run1 = 40 + r() * 140;
      x += dx * run1;
      y += dy * run1;
      ctx.lineTo(x, y);
      // 45° fan-out
      const bend = (off / (chip * 0.9)) * (60 + r() * 160);
      const px = dy !== 0 ? 1 : 0;
      const py = dx !== 0 ? 1 : 0;
      x += dx * Math.abs(bend) + px * bend;
      y += dy * Math.abs(bend) + py * bend;
      ctx.lineTo(x, y);
      const run2 = 120 + r() * (size * 0.32);
      x += dx * run2;
      y += dy * run2;
      ctx.lineTo(x, y);
      if (r() > 0.45) {
        const s2 = (r() > 0.5 ? 1 : -1) * (30 + r() * 80);
        x += dx * Math.abs(s2) + px * s2;
        y += dy * Math.abs(s2) + py * s2;
        ctx.lineTo(x, y);
        const run3 = 60 + r() * 260;
        x += dx * run3;
        y += dy * run3;
        ctx.lineTo(x, y);
      }
      ctx.lineWidth = 2.2 + r() * 2.4;
      ctx.strokeStyle = 'rgb(255,0,0)';
      ctx.stroke();
      // via at the end
      ctx.beginPath();
      ctx.arc(x, y, 5 + r() * 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(255,255,0)';
      ctx.fill();
    }
  }
  // scattered passives
  for (let i = 0; i < 260; i++) {
    const x = r() * size;
    const y = r() * size;
    if (Math.abs(x - half) < chip * 1.6 && Math.abs(y - half) < chip * 1.6) continue;
    ctx.fillStyle = `rgba(0,${120 + r() * 100},0,1)`;
    const w = 8 + r() * 16;
    ctx.fillRect(x, y, w, w * (0.4 + r() * 0.3));
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

/** Laser-etched marking on the chip lid. */
export function chipLidTexture() {
  const s = 1024;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#7d7f86';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 300px ${FONT}`;
  ctx.letterSpacing = '-8px';
  ctx.fillText('A20', s / 2, s * 0.44);
  ctx.font = `600 120px ${FONT}`;
  ctx.letterSpacing = '22px';
  ctx.fillText('PRO', s / 2 + 11, s * 0.68);
  ctx.letterSpacing = '0px';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
