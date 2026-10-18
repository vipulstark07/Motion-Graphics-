import * as THREE from 'three';
import { roundedRect, insetOutline, sweepProfile, capGeometry, arcProfile, slab, circleOutline } from './geometry.js';
import { grainTexture, flashTexture, lockScreenTexture } from './textures.js';

// iPhone 18 Pro, built to the published 6.3" dimensions:
// 150.0 x 71.9 x 8.75 mm. One scene unit = 10 mm.
export const DIMS = {
  W: 7.19,
  H: 15.0,
  D: 0.875,
  corner: 1.42, // superellipse corner radius of the outline
  rf: 0.09, // front glass edge round-over
  rb: 0.3, // rear edge round-over (inset)
  rbz: 0.32, // rear edge round-over (depth)
  plateauBottom: 15.0 / 2 - 4.55, // full-width camera plateau
  plateauHeight: 0.17,
  bezel: 0.2,
};

// Anodised aluminium unibody finishes. Rear glass is colour-matched this year,
// so glass and frame share a tone.
export const FINISHES = {
  black: { name: 'Black', alu: '#2a2a2d', glass: '#2b2b2e', ring: '#3a3a3e', env: 1.15 },
  silver: { name: 'Silver', alu: '#d6d7da', glass: '#dcdde0', ring: '#e8e8ea', env: 0.9 },
  glacier: { name: 'Glacier', alu: '#a7bccf', glass: '#b3c6d6', ring: '#c4d3e0', env: 0.95 },
  burgundy: { name: 'Burgundy', alu: '#6b1729', glass: '#691628', ring: '#8a2a3d', env: 1.1 },
};

// Lens layout on the plateau, in rear-view coordinates (x to the right when
// looking at the back). Triangle cluster on the left, flash / mic / LiDAR
// stacked on the right.
const H2 = DIMS.H / 2;
const W2 = DIMS.W / 2;
export const LENS_LAYOUT = {
  main: { x: -W2 + 1.33, y: H2 - 1.27 },
  lower: { x: -W2 + 1.33, y: H2 - 3.33 },
  side: { x: -W2 + 3.12, y: H2 - 2.3 },
  flash: { x: W2 - 1.02, y: H2 - 1.32 },
  mic: { x: W2 - 1.02, y: H2 - 2.3 },
  lidar: { x: W2 - 1.02, y: H2 - 3.28 },
};

const shared = {};
function sharedTex() {
  if (!shared.grain) {
    shared.grain = grainTexture();
    shared.flash = flashTexture();
  }
  return shared;
}

const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

function makeMaterials(finish) {
  const { grain } = sharedTex();
  const alu = new THREE.MeshPhysicalMaterial({
    color: finish.alu,
    metalness: 1,
    roughness: 0.36,
    bumpMap: grain,
    bumpScale: 0.35,
    clearcoat: 0.25,
    clearcoatRoughness: 0.32,
    envMapIntensity: finish.env,
  });
  const aluPolished = new THREE.MeshPhysicalMaterial({
    color: finish.ring,
    metalness: 1,
    roughness: 0.1,
    envMapIntensity: finish.env * 1.2,
  });
  const backGlass = new THREE.MeshPhysicalMaterial({
    color: finish.glass,
    metalness: 1,
    roughness: 0.34,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    bumpMap: grain,
    bumpScale: 0.25,
    clearcoat: 0.3,
    clearcoatRoughness: 0.25,
    envMapIntensity: finish.env,
  });
  return { alu, aluPolished, backGlass };
}

// Materials that never change between finishes.
let common;
function commonMaterials() {
  if (common) return common;
  const { flash } = sharedTex();
  common = {
    frontGlass: new THREE.MeshPhysicalMaterial({ color: '#030304', metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 }),
    gloss: new THREE.MeshPhysicalMaterial({
      color: '#000000', metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 1.2,
    }),
    black: new THREE.MeshStandardMaterial({ color: '#050506', roughness: 0.6, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    blackGloss: new THREE.MeshPhysicalMaterial({ color: '#060608', roughness: 0.12, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05 }),
    lensWell: new THREE.MeshStandardMaterial({ color: '#0b0b0d', roughness: 0.42, metalness: 0.6, side: THREE.DoubleSide }),
    coating: new THREE.MeshPhysicalMaterial({
      color: '#0b0d18', metalness: 1, roughness: 0.12,
      iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 620],
      side: THREE.DoubleSide,
    }),
    coatingInner: new THREE.MeshPhysicalMaterial({
      color: '#10122a', metalness: 1, roughness: 0.08,
      iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [320, 900],
      side: THREE.DoubleSide,
    }),
    sapphire: new THREE.MeshPhysicalMaterial({
      color: '#000000', metalness: 0, roughness: 0.015, clearcoat: 1, clearcoatRoughness: 0.0,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 1.6,
    }),
    flash: new THREE.MeshPhysicalMaterial({ map: flash, roughness: 0.35, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1 }),
    cameraControl: new THREE.MeshPhysicalMaterial({ color: '#141418', metalness: 0.3, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 }),
  };
  return common;
}

// Six-blade iris rendered procedurally: hexagonal opening, pinwheel seams,
// per-blade sheen. Pixels inside the opening are discarded so the coated
// elements below show through.
function irisMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uR: { value: 0.6 }, uRot: { value: 0.0 }, uLight: { value: 0.8 } },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uR;
      uniform float uRot;
      uniform float uLight;
      varying vec2 vUv;
      float hash(float n) { return fract(sin(n * 91.345) * 47453.5453); }
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float rr = length(p);
        if (rr > 1.0) discard;
        float d[6];
        bool inside = true;
        for (int i = 0; i < 6; i++) {
          float th = uRot + float(i) * 1.04719755;
          d[i] = dot(p, vec2(cos(th), sin(th)));
          if (d[i] > uR) inside = false;
        }
        if (inside) discard;
        int j = 0;
        for (int i = 0; i < 6; i++) {
          if (d[i] > uR && d[(i + 1) % 6] <= uR) j = i;
        }
        int jn = (j + 1) % 6;
        float ang = atan(p.y, p.x);
        vec3 base = vec3(0.028, 0.029, 0.033) * (0.75 + 0.5 * hash(float(j)));
        float sheen = pow(max(0.0, cos(ang - uLight - float(j) * 0.35)), 5.0);
        vec3 col = base + vec3(0.16, 0.155, 0.17) * sheen * (0.4 + 0.6 * rr);
        // shadow cast by the blade lying above this one
        float sh = smoothstep(0.0, 0.05, uR - d[jn]);
        col *= mix(0.35, 1.0, sh);
        // bright, razor-thin leading edge facing the opening
        float edge = 1.0 - smoothstep(0.0, 0.012, d[j] - uR);
        col += vec3(0.5, 0.48, 0.5) * edge * (0.25 + 0.75 * sheen);
        // barrel
        col *= 1.0 - smoothstep(0.9, 1.0, rr) * 0.8;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// ---------- lens assembly (local +z points out of the plateau) ----------

function ringGeometry(rOut, rIn, h) {
  return cached(`ring-${rOut}-${rIn}-${h}`, () => {
    const pts = [
      new THREE.Vector2(rIn + 0.02, 0),
      new THREE.Vector2(rOut, 0),
      new THREE.Vector2(rOut, h * 0.62),
      new THREE.Vector2(rOut - 0.006, h * 0.8),
      new THREE.Vector2(rOut - 0.02, h * 0.93),
      new THREE.Vector2(rOut - 0.04, h),
      new THREE.Vector2(rIn + 0.075, h),
    ];
    const g = new THREE.LatheGeometry(pts, 128);
    g.rotateX(Math.PI / 2);
    return g;
  });
}

function chamferGeometry(rIn, h) {
  return cached(`chamfer-${rIn}-${h}`, () => {
    const pts = [
      new THREE.Vector2(rIn + 0.075, h),
      new THREE.Vector2(rIn + 0.03, h - 0.03),
      new THREE.Vector2(rIn, h - 0.045),
    ];
    const g = new THREE.LatheGeometry(pts, 128);
    g.rotateX(Math.PI / 2);
    return g;
  });
}

function wellGeometry(rIn, h) {
  return cached(`well-${rIn}-${h}`, () => {
    const g = new THREE.CylinderGeometry(rIn, rIn, h, 96, 1, true);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, h / 2);
    return g;
  });
}

function disc(r, z, mat, seg = 96) {
  const m = new THREE.Mesh(cached(`disc-${r}`, () => new THREE.CircleGeometry(r, seg)), mat);
  m.position.z = z;
  return m;
}

function dome(r, height, mat) {
  const g = cached(`dome-${r}-${height}`, () => {
    const s = new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    s.rotateX(Math.PI / 2);
    s.scale(r, r, height);
    return s;
  });
  return new THREE.Mesh(g, mat);
}

function makeLens(mats, cm, { iris = false } = {}) {
  const g = new THREE.Group();
  const rOut = 0.8;
  const rIn = 0.64;
  const h = 0.13;
  g.add(new THREE.Mesh(ringGeometry(rOut, rIn, h), mats.alu));
  g.add(new THREE.Mesh(chamferGeometry(rIn, h), mats.aluPolished));
  g.add(new THREE.Mesh(wellGeometry(rIn, h - 0.045), cm.lensWell));
  g.add(disc(rIn, 0.004, cm.black));
  g.add(disc(0.56, 0.018, cm.lensWell));
  const e1 = disc(0.47, 0.03, cm.coating);
  g.add(e1);
  const d1 = dome(0.3, 0.05, cm.coatingInner);
  d1.position.z = 0.032;
  g.add(d1);
  const d2 = dome(0.12, 0.03, cm.blackGloss);
  d2.position.z = 0.05;
  g.add(d2);
  let irisMat = null;
  if (iris) {
    irisMat = irisMaterial();
    g.add(disc(0.6, 0.092, irisMat));
  }
  g.add(disc(rIn, h - 0.03, cm.sapphire));
  return { group: g, irisMat };
}

function makeSmallPort(mats, cm, kind) {
  const g = new THREE.Group();
  const rOut = 0.36;
  const rIn = 0.28;
  const h = 0.045;
  g.add(new THREE.Mesh(ringGeometry(rOut, rIn, h), mats.alu));
  if (kind === 'flash') {
    g.add(disc(rIn + 0.02, 0.006, cm.flash));
  } else {
    g.add(disc(rIn + 0.02, 0.004, cm.blackGloss));
    const d = dome(0.11, 0.02, cm.coating);
    d.position.z = 0.006;
    g.add(d);
  }
  g.add(disc(rIn + 0.02, 0.03, cm.sapphire));
  return g;
}

// ---------- body ----------

function bodyGeometries() {
  return cached('body', () => {
    const { W, H, D, corner, rf, rb, rbz, plateauBottom, plateauHeight } = DIMS;
    const outline = roundedRect(W, H, corner, corner, { segments: 40 });
    const front = arcProfile({ fromWall: 0, zWall: D / 2 - rf, zFace: D / 2, r: rf, steps: 8, facing: 1 }).reverse();
    const side = [];
    for (let i = 0; i <= 4; i++) {
      const z = D / 2 - rf - (i / 4) * (D - rf - rbz);
      side.push({ o: 0, z, nr: 1, nz: 0 });
    }
    const back = arcProfile({ fromWall: 0, zWall: -D / 2 + rbz, zFace: -D / 2, r: rb, steps: 14, facing: -1 });
    const frame = sweepProfile(outline, [...side, ...back.slice(1)]);
    const glassEdge = sweepProfile(outline, front);
    const frontCap = capGeometry(insetOutline(outline, rf), D / 2, 1);
    const backCap = capGeometry(insetOutline(outline, rb), -D / 2, -1);

    // Plateau: same outline as the body along the top, rounded bottom corners.
    const pH = H / 2 - plateauBottom;
    const pOutline = roundedRect(W, pH, corner, 0.95, { cy: plateauBottom + pH / 2, segments: 40 });
    const rp = 0.24;
    const pProfile = [
      { o: 0, z: -D / 2 + rbz - 0.002, nr: 1, nz: 0 },
      ...arcProfile({ fromWall: 0, zWall: -D / 2 - plateauHeight + 0.14, zFace: -D / 2 - plateauHeight, r: rp, steps: 14, facing: -1 }),
    ];
    const plateau = sweepProfile(pOutline, pProfile);
    const plateauCap = capGeometry(insetOutline(pOutline, rp), -D / 2 - plateauHeight, -1);

    // Colour-matched Ceramic Shield panel below the plateau.
    const gTop = plateauBottom - 0.62;
    const gBottom = -H / 2 + 0.62;
    const gOutline = roundedRect(W - 1.16, gTop - gBottom, 0.82, 1.0, { cy: (gTop + gBottom) / 2 });
    const backPanel = capGeometry(gOutline, -D / 2 - 0.009, -1);
    const backSeam = capGeometry(insetOutline(gOutline, -0.018), -D / 2 - 0.004, -1);

    const display = capGeometry(insetOutline(outline, DIMS.bezel), D / 2 + 0.004, 1);
    const gloss = capGeometry(insetOutline(outline, rf), D / 2 + 0.009, 1);
    return { outline, frame, glassEdge, frontCap, backCap, plateau, plateauCap, backPanel, backSeam, display, gloss };
  });
}

function button(len, width, height, mat) {
  const g = cached(`btn-${len}-${width}-${height}`, () => {
    const o = roundedRect(width, len, width / 2 - 0.001, width / 2 - 0.001, { segments: 16, exponent: 2 });
    const s = slab(o, { height, radius: height * 0.8, steps: 6 });
    return s;
  });
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(g.side, mat));
  grp.add(new THREE.Mesh(g.cap, mat));
  return grp;
}

export function createPhone(finishKey = 'burgundy', { screen = true } = {}) {
  const finish = FINISHES[finishKey];
  const mats = makeMaterials(finish);
  const cm = commonMaterials();
  const geo = bodyGeometries();
  const { W, H, D } = DIMS;

  const root = new THREE.Group();
  root.name = `iPhone 18 Pro (${finish.name})`;

  root.add(new THREE.Mesh(geo.frame, mats.alu));
  root.add(new THREE.Mesh(geo.glassEdge, cm.frontGlass));
  root.add(new THREE.Mesh(geo.frontCap, cm.frontGlass));
  root.add(new THREE.Mesh(geo.backCap, mats.alu));
  root.add(new THREE.Mesh(geo.plateau, mats.alu));
  root.add(new THREE.Mesh(geo.plateauCap, mats.alu));
  root.add(new THREE.Mesh(geo.backSeam, cm.black));
  root.add(new THREE.Mesh(geo.backPanel, mats.backGlass));

  // Display + front glass reflections.
  let screenMat = null;
  if (screen) {
    screenMat = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    root.add(new THREE.Mesh(geo.display, screenMat));
  }
  const gloss = new THREE.Mesh(geo.gloss, cm.gloss);
  gloss.renderOrder = 2;
  root.add(gloss);

  // Buttons. Left: Action button, volume up, volume down. Right: side button, Camera Control.
  const zc = (D / 2 - DIMS.rf + (-D / 2 + DIMS.rbz)) / 2;
  const left = [
    [4.25, 0.72],
    [2.95, 1.25],
    [1.5, 1.25],
  ];
  for (const [y, len] of left) {
    const b = button(len, 0.27, 0.07, mats.alu);
    b.rotation.y = -Math.PI / 2;
    b.position.set(-W / 2 + 0.01, y, zc);
    root.add(b);
  }
  const side = button(1.9, 0.27, 0.07, mats.alu);
  side.rotation.y = Math.PI / 2;
  side.position.set(W / 2 - 0.01, 2.65, zc);
  root.add(side);
  const ccRecess = button(1.58, 0.3, 0.012, cm.black);
  ccRecess.rotation.y = Math.PI / 2;
  ccRecess.position.set(W / 2 - 0.006, -1.25, zc);
  root.add(ccRecess);
  const cc = button(1.5, 0.24, 0.016, cm.cameraControl);
  cc.rotation.y = Math.PI / 2;
  cc.position.set(W / 2 - 0.004, -1.25, zc);
  root.add(cc);

  // Bottom edge: USB-C and speaker / mic holes.
  const usb = new THREE.Mesh(cached('usb', () => {
    const g = capGeometry(roundedRect(0.9, 0.27, 0.134, 0.134, { exponent: 2, segments: 12 }), 0, 1);
    g.rotateX(Math.PI / 2);
    return g;
  }), cm.black);
  usb.position.set(0, -H / 2 - 0.002, zc);
  root.add(usb);
  const holeGeo = cached('hole', () => {
    const g = capGeometry(circleOutline(0.042, 20), 0, 1);
    g.rotateX(Math.PI / 2);
    return g;
  });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const h = new THREE.Mesh(holeGeo, cm.black);
      h.position.set(s * (0.95 + i * 0.2), -H / 2 - 0.002, zc);
      root.add(h);
    }
  }

  // Rear assembly lives in a rotated group so it can be laid out as seen from behind.
  const rear = new THREE.Group();
  rear.rotation.y = Math.PI;
  root.add(rear);
  const surface = D / 2 + DIMS.plateauHeight;
  const lenses = {};
  let irisMat = null;
  for (const key of ['main', 'lower', 'side']) {
    const l = makeLens(mats, cm, { iris: key === 'main' });
    l.group.position.set(LENS_LAYOUT[key].x, LENS_LAYOUT[key].y, surface);
    rear.add(l.group);
    lenses[key] = l.group;
    if (l.irisMat) irisMat = l.irisMat;
  }
  for (const key of ['flash', 'lidar']) {
    const p = makeSmallPort(mats, cm, key);
    p.position.set(LENS_LAYOUT[key].x, LENS_LAYOUT[key].y, surface);
    rear.add(p);
    lenses[key] = p;
  }
  const mic = disc(0.05, surface + 0.001, cm.black, 24);
  mic.position.x = LENS_LAYOUT.mic.x;
  mic.position.y = LENS_LAYOUT.mic.y;
  rear.add(mic);

  return {
    root,
    rear,
    lenses,
    finish,
    materials: mats,
    irisMat,
    screenMat,
    /** f-number -> iris opening. Opening diameter is proportional to 1/N. */
    setAperture(fNumber, lightAngle = 0.8) {
      if (!irisMat) return;
      const r = 1.15 / fNumber;
      irisMat.uniforms.uR.value = r;
      irisMat.uniforms.uRot.value = 0.35 + (0.78 - r) * 1.5;
      irisMat.uniforms.uLight.value = lightAngle;
    },
    setScreen(texture, brightness) {
      if (!screenMat) return;
      if (texture && screenMat.map !== texture) {
        screenMat.map = texture;
        screenMat.needsUpdate = true;
      }
      screenMat.color.setScalar(brightness);
    },
  };
}

export function createLockScreen() {
  const { W, H, bezel } = DIMS;
  const dims = { w: W - bezel * 2, h: H - bezel * 2 };
  return lockScreenTexture(dims, { w: 1.55, h: 0.54, top: 0.36 });
}
