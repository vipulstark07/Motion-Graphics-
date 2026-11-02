// Pink-lit architectural residence, rendered with three.js for a website hero.
// Usage:  import { mountBuilding } from './building.js';
//         const scene = mountBuilding(document.querySelector('canvas'));
// The canvas background stays transparent, so the page's own CSS gradient shows
// through. The glossy floor reflection fades out radially into that gradient.

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const PALETTE = {
  render: '#f5f2f6',      // white architectural render
  clad: '#a3a5b0',        // grey composite cladding
  seam: '#7c7e89',
  frame: '#16171b',       // black aluminium frames
  interiorFloor: '#c9b29b',
  interiorWall: '#ddbfa6',
  pink: '#ff3fbf',        // LED strip colour
  pinkCore: '#ffd2f1',
  warm: '#ffc483',        // interior lighting
  leaf: ['#4f7a4a', '#5f8a52', '#3f6a45', '#6f9658', '#56804e'],
};

export function mountBuilding(canvas, options = {}) {
  const opts = {
    reducedMotion: false,
    pixelRatioCap: 2,
    ...options,
  };

  const isSmall = () => Math.min(window.innerWidth, window.innerHeight) < 700;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  RectAreaLightUniformsLib.init();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

  // ---------- shared materials ----------
  const M = {
    render: new THREE.MeshStandardMaterial({ color: PALETTE.render, roughness: 0.55, metalness: 0, envMapIntensity: 0.32 }),
    clad: new THREE.MeshStandardMaterial({ color: PALETTE.clad, roughness: 0.42, metalness: 0.2, envMapIntensity: 0.8 }),
    seam: new THREE.MeshStandardMaterial({ color: PALETTE.seam, roughness: 0.5, metalness: 0.2 }),
    frame: new THREE.MeshStandardMaterial({ color: PALETTE.frame, roughness: 0.32, metalness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#ffffff', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.14,
      envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide,
    }),
    balustrade: new THREE.MeshPhysicalMaterial({
      color: '#e9f7ff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22,
      envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide,
    }),
    floor: new THREE.MeshStandardMaterial({ color: PALETTE.interiorFloor, roughness: 0.45, metalness: 0 }),
    wall: new THREE.MeshStandardMaterial({ color: PALETTE.interiorWall, roughness: 0.8, metalness: 0 }),
    deck: new THREE.MeshStandardMaterial({ color: '#ece6ea', roughness: 0.5, metalness: 0 }),
    sofa: new THREE.MeshStandardMaterial({ color: '#8f8b9a', roughness: 0.9 }),
    cushion: new THREE.MeshStandardMaterial({ color: '#c3bfcc', roughness: 0.95 }),
    cream: new THREE.MeshStandardMaterial({ color: '#f0ebe6', roughness: 0.85 }),
    pillowPink: new THREE.MeshStandardMaterial({ color: '#eaa3cf', roughness: 0.9 }),
    marble: new THREE.MeshStandardMaterial({ color: '#f4f2f2', roughness: 0.25 }),
    rug: new THREE.MeshStandardMaterial({ color: '#cfc7cc', roughness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: '#3b3439', roughness: 0.7 }),
    planter: new THREE.MeshStandardMaterial({ color: '#e6e2e8', roughness: 0.7 }),
    soil: new THREE.MeshStandardMaterial({ color: '#3a2c26', roughness: 1 }),
    trunk: new THREE.MeshStandardMaterial({ color: '#6b4b45', roughness: 0.8, emissive: '#ff2fa8', emissiveIntensity: 0.35 }),
    warmLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.warm).multiplyScalar(1.6), toneMapped: false }),
    ledCore: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.pinkCore).multiplyScalar(1.4), toneMapped: false }),
    art: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, map: makeArtTexture() }),
    curtain: new THREE.MeshStandardMaterial({ color: '#f7eef3', roughness: 0.9, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
  };

  const glowTex = makeGlowStripTexture();
  const poolTex = makeRadialTexture();
  const haloMat = new THREE.MeshBasicMaterial({
    map: glowTex, color: PALETTE.pink, transparent: true, opacity: 0.95,
    depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });

  const root = new THREE.Group();      // floats + sways
  scene.add(root);
  const building = new THREE.Group();
  root.add(building);

  // ---------- helpers ----------
  const shadowCasters = [];
  function box(mat, x0, x1, y0, y1, z0, z1, parent = building, cast = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    if (cast) { m.castShadow = true; shadowCasters.push(m); }
    parent.add(m);
    return m;
  }

  // LED strip with soft glow halos. axis 'x' or 'z'; halos: 'down' | 'up' | 'out'
  const glowMeshes = [];
  function ledStrip(axis, a, b, fixedA, y, outward, halos, haloSize = 1.25) {
    const len = Math.abs(b - a);
    const mid = (a + b) / 2;
    const core = new THREE.Mesh(
      axis === 'x' ? new THREE.BoxGeometry(len, 0.06, 0.06) : new THREE.BoxGeometry(0.06, 0.06, len),
      M.ledCore,
    );
    if (axis === 'x') core.position.set(mid, y, fixedA); else core.position.set(fixedA, y, mid);
    building.add(core);
    for (const h of halos) {
      const size = h === 'out' ? haloSize * 0.75 : haloSize;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(len + size * 0.6, size), haloMat);
      plane.position.copy(core.position);
      if (h === 'down') {
        plane.rotation.x = Math.PI / 2;
        plane.position.y += 0.005;
        if (axis === 'z') plane.rotation.z = Math.PI / 2;
      } else if (h === 'up') {
        plane.rotation.x = -Math.PI / 2;
        if (axis === 'z') plane.rotation.z = Math.PI / 2;
        plane.position.y = y;
        plane.position.add(outward.clone().multiplyScalar(size * 0.45));
      } else {
        if (axis === 'z') plane.rotation.y = Math.PI / 2;
        plane.position.add(outward.clone().multiplyScalar(0.03));
      }
      plane.renderOrder = 5;
      building.add(plane);
      glowMeshes.push(plane);
    }
    return core;
  }

  // ---------- site base (two-step terrace) ----------
  const Y_LOW = 0.18, Y_UP = 0.36;
  box(M.render, -6.6, 6.2, 0, Y_LOW, -4.4, 5.4);
  box(M.render, -5.2, 5.4, Y_LOW, Y_UP, -3.9, 4.7);

  // planter at the front-left corner
  box(M.planter, -8.2, -4.4, 0, 0.75, 1.6, 5.2);
  box(M.soil, -8.05, -4.55, 0.75, 0.76, 1.75, 5.05, building, false);

  // ---------- core structure ----------
  const GF0 = Y_UP, GF1 = 3.15, FF0 = 3.6, FF1 = 6.6;
  // grey clad block on the right, rising through both storeys
  box(M.clad, 3.2, 4.9, Y_UP, FF1, -3.3, 3.3);
  // first-floor slab and roof slab, both oversailing
  box(M.render, -5.4, 5.3, GF1, FF0, -3.7, 4.0);
  box(M.render, -5.6, 5.5, FF1, 7.15, -3.9, 4.2);
  // white walls
  box(M.render, -4.75, -4.45, GF0, GF1, -3.2, 3.3);       // GF left wall
  box(M.render, -4.75, -4.45, FF0, FF1, -3.2, 2.0);       // FF left wall / pier
  box(M.render, -4.75, 3.2, GF0, GF1, -3.4, -3.2);        // GF rear wall (exterior)
  box(M.render, -4.75, 3.2, FF0, FF1, -3.4, -3.2);        // FF rear wall (exterior)

  // cladding seams
  const seamLines = [
    // front face (z = 3.3)
    [3.2, 4.9, 1.9, 1.925, 3.3, 3.306], [3.2, 4.9, 5.1, 5.125, 3.3, 3.306],
    [4.04, 4.06, GF0, GF1, 3.3, 3.306], [4.04, 4.06, FF0, FF1, 3.3, 3.306],
    // side face (x = 4.9)
    [4.9, 4.906, 1.9, 1.925, -3.3, -1.8], [4.9, 4.906, 5.1, 5.125, -3.3, -1.6],
    [4.9, 4.906, 1.9, 1.925, 1.4, 3.3], [4.9, 4.906, 5.1, 5.125, 1.6, 3.3],
    [4.9, 4.906, GF0, GF1, -2.5, -2.475], [4.9, 4.906, FF0, FF1, -2.5, -2.475],
    [4.9, 4.906, GF0, GF1, 2.45, 2.475], [4.9, 4.906, FF0, FF1, 2.45, 2.475],
  ];
  for (const s of seamLines) box(M.seam, ...s, building, false);

  // side windows in the clad block (warm interior glow behind smoked glass)
  const sideGlow = new THREE.MeshStandardMaterial({
    color: '#2a2328', roughness: 0.1, metalness: 0.2, emissive: '#ffffff',
    emissiveMap: makeWindowGlowTexture(), emissiveIntensity: 1.0,
  });
  function sideWindow(z0, z1, y0, y1) {
    box(sideGlow, 4.9, 4.93, y0, y1, z0, z1, building, false);
    box(M.frame, 4.9, 4.97, y0 - 0.05, y0, z0 - 0.05, z1 + 0.05, building, false);
    box(M.frame, 4.9, 4.97, y1, y1 + 0.05, z0 - 0.05, z1 + 0.05, building, false);
    box(M.frame, 4.9, 4.97, y0, y1, z0 - 0.05, z0, building, false);
    box(M.frame, 4.9, 4.97, y0, y1, z1, z1 + 0.05, building, false);
    box(M.frame, 4.9, 4.97, y0, y1, (z0 + z1) / 2 - 0.025, (z0 + z1) / 2 + 0.025, building, false);
  }
  sideWindow(-1.7, 1.3, 0.75, 2.85);
  sideWindow(-1.5, 1.5, 3.95, 6.25);

  // ---------- ground floor interior ----------
  box(M.floor, -4.45, 3.2, GF0, GF0 + 0.02, -3.2, 3.15, building, false);
  box(M.wall, -4.45, 3.2, GF0, GF1, -3.2, -3.0, building, false);       // back wall
  box(M.wall, 3.16, 3.2, GF0, GF1, -3.2, 3.1, building, false);         // right interior wall
  box(M.wall, -4.45, -4.42, GF0, GF1, -3.2, 3.1, building, false);      // left interior wall
  // artwork + doorway on the back wall
  box(M.art, -1.6, -0.1, 1.45, 2.4, -3.0, -2.97, building, false);
  box(M.dark, 1.85, 2.75, GF0, 2.55, -3.0, -2.98, building, false);
  // cove light along the back ceiling
  box(M.warmLight, -4.4, 3.1, GF1 - 0.06, GF1 - 0.03, -2.95, -2.9, building, false);
  // rug, sofa, armchair, coffee table
  const Y0 = GF0 + 0.02;
  box(M.rug, -3.1, 1.5, Y0, Y0 + 0.015, -2.1, 1.0, building, false);
  box(M.sofa, -2.7, 0.5, Y0, Y0 + 0.4, -2.0, -1.15);
  box(M.sofa, -2.7, 0.5, Y0, Y0 + 0.8, -2.25, -1.95);
  box(M.sofa, -0.4, 0.5, Y0, Y0 + 0.4, -2.0, -0.2);
  box(M.sofa, -2.95, -2.7, Y0, Y0 + 0.6, -2.25, -1.15);
  for (let i = 0; i < 3; i++) box(M.cushion, -2.65 + i * 1.03, -1.67 + i * 1.03, Y0 + 0.4, Y0 + 0.52, -1.95, -1.2, building, false);
  box(M.cushion, -0.35, 0.45, Y0 + 0.4, Y0 + 0.52, -1.15, -0.25, building, false);
  box(M.pillowPink, -2.4, -1.95, Y0 + 0.5, Y0 + 0.9, -1.98, -1.84, building, false);
  box(M.cream, -0.6, -0.15, Y0 + 0.5, Y0 + 0.88, -1.98, -1.84, building, false);
  box(M.cream, 1.3, 2.2, Y0, Y0 + 0.42, -1.3, -0.4);
  box(M.cream, 1.3, 2.2, Y0, Y0 + 0.85, -1.45, -1.25);
  box(M.cream, 1.2, 1.32, Y0, Y0 + 0.62, -1.45, -0.4);
  box(M.cream, 2.18, 2.3, Y0, Y0 + 0.62, -1.45, -0.4);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.34, 40), M.marble);
  table.position.set(-1.0, Y0 + 0.17, -0.35);
  table.castShadow = true; table.receiveShadow = true;
  building.add(table);
  // ring pendant
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.028, 12, 96), M.warmLight);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(-1.0, 2.35, -0.5);
  building.add(ring);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, GF1 - 2.35, 4), M.frame);
    wire.position.set(-1.0 + Math.cos(a) * 0.6, (GF1 + 2.35) / 2, -0.5 + Math.sin(a) * 0.6);
    building.add(wire);
  }
  // downlights
  for (const [x, z] of [[-3.6, -1.6], [-3.6, 1.2], [1.8, -1.6], [1.8, 1.2], [-1.0, 1.6]]) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 16), M.warmLight);
    d.position.set(x, GF1 - 0.006, z);
    building.add(d);
  }
  // sheer curtains
  curtain(-4.35, -3.75, GF0 + 0.05, GF1 - 0.08, 2.95);
  curtain(2.55, 3.1, GF0 + 0.05, GF1 - 0.08, 2.95);
  curtain(-0.95, -0.4, GF0 + 0.05, GF1 - 0.08, 2.95);

  // ---------- ground floor glazing (z = 3.15) ----------
  glazingRun(-4.45, 3.2, GF0, GF1, 3.15, 4);

  // ---------- first floor ----------
  box(M.floor, -4.45, 3.2, FF0, FF0 + 0.02, -3.2, 1.9, building, false);
  box(M.deck, -5.2, 3.2, FF0, FF0 + 0.02, 1.9, 3.85, building, false);
  box(M.wall, -4.45, 3.2, FF0, FF1, -3.2, -3.0, building, false);
  box(M.wall, 3.16, 3.2, FF0, FF1, -3.2, 1.85, building, false);
  box(M.wall, -4.45, -4.42, FF0, FF1, -3.2, 1.85, building, false);
  box(M.art, 0.4, 1.6, 4.6, 5.5, -3.0, -2.97, building, false);
  box(M.warmLight, -4.4, 3.1, FF1 - 0.06, FF1 - 0.03, -2.95, -2.9, building, false);
  const F0 = FF0 + 0.02;
  box(M.rug, -3.2, 0.8, F0, F0 + 0.015, -2.6, 0.6, building, false);
  box(M.cream, -3.0, -0.6, F0, F0 + 0.45, -2.9, -1.0);              // low bed
  box(M.cushion, -3.0, -0.6, F0 + 0.45, F0 + 0.55, -2.9, -1.0, building, false);
  box(M.sofa, -3.1, -0.5, F0, F0 + 1.0, -3.0, -2.88);                 // headboard
  box(M.pillowPink, -2.6, -2.0, F0 + 0.55, F0 + 0.75, -2.8, -2.6, building, false);
  box(M.cream, -1.6, -1.0, F0 + 0.55, F0 + 0.75, -2.8, -2.6, building, false);
  box(M.cream, 1.4, 2.2, F0, F0 + 0.42, -1.2, -0.4);                 // lounge chair
  box(M.cream, 1.4, 2.2, F0, F0 + 0.85, -1.35, -1.15);
  for (const [x, z] of [[-2.8, 0.6], [-0.4, 0.6], [1.8, 0.6], [-2.8, -1.8], [1.8, -1.8]]) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 16), M.warmLight);
    d.position.set(x, FF1 - 0.006, z);
    building.add(d);
  }
  curtain(-4.35, -3.8, F0 + 0.03, FF1 - 0.08, 1.75);
  curtain(2.6, 3.1, F0 + 0.03, FF1 - 0.08, 1.75);
  glazingRun(-4.45, 3.2, FF0, FF1, 1.9, 4);

  // glass balustrade around the balcony
  box(M.balustrade, -5.25, 3.2, FF0 + 0.02, FF0 + 1.1, 3.83, 3.86, building, false);
  box(M.balustrade, -5.26, -5.23, FF0 + 0.02, FF0 + 1.1, 1.9, 3.85, building, false);
  box(M.frame, -5.27, 3.2, FF0 + 0.02, FF0 + 0.08, 3.81, 3.88, building, false);
  box(M.frame, -5.29, -5.21, FF0 + 0.02, FF0 + 0.08, 1.9, 3.88, building, false);

  // ---------- LED strips (soffits, fascia, terrace steps) ----------
  const OUT_Z = new THREE.Vector3(0, 0, 1), OUT_X = new THREE.Vector3(1, 0, 0), OUT_NX = new THREE.Vector3(-1, 0, 0);
  // first-floor slab soffit
  ledStrip('x', -5.15, 5.05, 3.75, GF1 - 0.03, OUT_Z, ['down', 'out']);
  ledStrip('z', -3.45, 3.75, 5.05, GF1 - 0.03, OUT_X, ['down', 'out']);
  ledStrip('z', -3.45, 3.75, -5.15, GF1 - 0.03, OUT_NX, ['down', 'out']);
  // roof soffit
  ledStrip('x', -5.35, 5.25, 3.95, FF1 - 0.03, OUT_Z, ['down', 'out']);
  ledStrip('z', -3.65, 3.95, 5.25, FF1 - 0.03, OUT_X, ['down', 'out']);
  ledStrip('z', -3.65, 3.95, -5.35, FF1 - 0.03, OUT_NX, ['down', 'out']);
  // terrace steps
  ledStrip('x', -4.4, 5.4, 4.72, Y_UP - 0.05, OUT_Z, ['out', 'up'], 0.9);
  ledStrip('z', -3.9, 4.7, 5.42, Y_UP - 0.05, OUT_X, ['out', 'up'], 0.9);
  ledStrip('x', -4.4, 6.2, 5.42, Y_LOW - 0.05, OUT_Z, ['out', 'up'], 1.1);
  ledStrip('z', -4.4, 5.4, 6.22, Y_LOW - 0.05, OUT_X, ['out', 'up'], 1.1);

  // ---------- planting ----------
  const leafTex = makeLeafTexture();
  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75, metalness: 0,
  });
  const foliage = [];
  function addFoliage(list, geo) {
    const inst = new THREE.InstancedMesh(geo, leafMat, list.length);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    list.forEach((l, i) => {
      dummy.position.copy(l.p);
      dummy.quaternion.copy(l.q);
      dummy.scale.setScalar(l.s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, col.set(l.c));
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.receiveShadow = true;
    building.add(inst);
    foliage.push(inst);
  }
  const rng = mulberry32(7);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const leafGeo = new THREE.PlaneGeometry(0.16, 0.3); leafGeo.translate(0, 0.15, 0);
  const frondGeo = new THREE.PlaneGeometry(0.1, 0.62); frondGeo.translate(0, 0.31, 0);

  function bush(center, radius, count, list, squash = 0.75) {
    const c = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(rng() * 2 - 1, rng() * 1.2 - 0.2, rng() * 2 - 1).normalize();
      const r = radius * (0.55 + rng() * 0.45);
      const p = center.clone().add(new THREE.Vector3(dir.x * r, dir.y * r * squash, dir.z * r));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        dir.clone().add(new THREE.Vector3((rng() - 0.5) * 0.8, 0.4, (rng() - 0.5) * 0.8)).normalize());
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2));
      list.push({ p, q, s: 0.8 + rng() * 0.6, c: pick(PALETTE.leaf) });
    }
    return c;
  }
  function fern(center, count, list, length = 1) {
    for (let i = 0; i < count; i++) {
      const yaw = rng() * Math.PI * 2;
      const tilt = 0.35 + rng() * 0.75;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ'));
      list.push({ p: center.clone(), q, s: length * (0.75 + rng() * 0.5), c: pick(PALETTE.leaf) });
    }
  }
  function pot(x, z, y, h = 0.42, r = 0.2) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.78, h, 28), M.planter);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    building.add(m);
    return y + h;
  }

  const leaves = [], fronds = [];
  // planter: ferns + low shrubs
  const SOIL = 0.76;
  for (const [x, z] of [[-7.6, 4.6], [-6.6, 4.8], [-5.4, 4.6], [-7.7, 2.3], [-5.0, 2.2], [-6.0, 3.8]]) {
    fern(new THREE.Vector3(x, SOIL, z), 26, fronds, 1.0);
  }
  for (const [x, z, r] of [[-7.1, 3.4, 0.55], [-5.0, 3.4, 0.5], [-4.9, 4.7, 0.42], [-7.8, 5.0, 0.4]]) {
    bush(new THREE.Vector3(x, SOIL + r * 0.6, z), r, 140, leaves);
  }
  // feature tree with pink uplight
  const TX = -6.6, TZ = 3.0;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 2.1, 12), M.trunk);
  trunk.position.set(TX, SOIL + 1.05, TZ);
  trunk.castShadow = true;
  building.add(trunk);
  for (const [dx, dz, ry] of [[0.5, 0.2, -0.6], [-0.45, -0.1, 0.6], [0.1, -0.5, 0.2]]) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 1.0, 8), M.trunk);
    br.position.set(TX + dx * 0.5, SOIL + 1.9, TZ + dz * 0.5);
    br.rotation.set(dz * 1.2, 0, -dx * 1.2 + ry * 0.1);
    building.add(br);
  }
  for (const [dx, dy, dz, r] of [[0, 3.05, 0, 0.95], [0.55, 2.7, 0.2, 0.7], [-0.6, 2.75, -0.1, 0.72], [0.1, 2.55, -0.55, 0.65], [-0.1, 2.6, 0.55, 0.62]]) {
    bush(new THREE.Vector3(TX + dx, SOIL + dy, TZ + dz), r, 260, leaves, 0.6);
  }
  // potted plants on the terrace and balcony
  for (const [x, z] of [[3.75, 4.25], [-3.9, 4.3]]) {
    const top = pot(x, z, Y_UP, 0.45, 0.2);
    fern(new THREE.Vector3(x, top, z), 18, fronds, 0.8);
  }
  { const top = pot(-4.75, 3.35, FF0 + 0.02, 0.5, 0.24); fern(new THREE.Vector3(-4.75, top, 3.35), 22, fronds, 1.15); }
  { const top = pot(2.6, 3.4, FF0 + 0.02, 0.4, 0.18); fern(new THREE.Vector3(2.6, top, 3.4), 16, fronds, 0.75); }
  // interior plants
  { const top = pot(-3.95, -2.55, Y0, 0.5, 0.22); bush(new THREE.Vector3(-3.95, top + 0.55, -2.55), 0.45, 120, leaves); }
  { const top = pot(2.75, 2.5, Y0, 0.35, 0.16); fern(new THREE.Vector3(2.75, top, 2.5), 14, fronds, 0.7); }
  { const top = pot(-3.9, 1.2, F0, 0.45, 0.2); bush(new THREE.Vector3(-3.9, top + 0.45, 1.2), 0.38, 100, leaves); }
  addFoliage(leaves, leafGeo);
  addFoliage(fronds, frondGeo);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight('#fff4fb', '#ff9fd8', 0.38);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff6fb', 1.15);
  key.position.set(7, 15, 11);
  key.target.position.set(-0.8, 2.5, 0.4);
  key.castShadow = true;
  key.shadow.mapSize.set(isSmall() ? 1024 : 2048, isSmall() ? 1024 : 2048);
  key.shadow.camera.left = -11; key.shadow.camera.right = 11;
  key.shadow.camera.top = 11; key.shadow.camera.bottom = -11;
  key.shadow.camera.near = 1; key.shadow.camera.far = 45;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 5;
  scene.add(key, key.target);
  const cyanRim = new THREE.DirectionalLight('#7ff3ec', 0.55);
  cyanRim.position.set(14, 4, -6);
  scene.add(cyanRim);
  const pinkFill = new THREE.DirectionalLight('#ff6fcf', 0.5);
  pinkFill.position.set(-14, 3, 6);
  scene.add(pinkFill);

  // pink LED wash lights (RectAreaLights face down from each soffit)
  const pinkWash = [];
  function wash(w, h, x, y, z, tx, ty, tz, intensity) {
    const l = new THREE.RectAreaLight(PALETTE.pink, intensity, w, h);
    l.position.set(x, y, z);
    l.lookAt(tx, ty, tz);
    l.userData.base = intensity;
    building.add(l);
    pinkWash.push(l);
  }
  wash(10.2, 0.6, -0.05, GF1 - 0.05, 3.6, -0.05, 0, 3.9, 14);
  wash(7.0, 0.6, 5.0, GF1 - 0.05, 0.2, 5.3, 0, 0.2, 11);
  wash(10.6, 0.6, -0.05, FF1 - 0.05, 3.8, -0.05, 3.5, 4.0, 14);
  wash(7.4, 0.6, 5.2, FF1 - 0.05, 0.15, 5.4, 3.5, 0.15, 11);
  wash(10.0, 0.4, 0.5, 0.05, 5.8, 0.5, 2.5, 5.6, 4);   // terrace step glow up the facade

  // warm interior lights
  const warmGF = new THREE.PointLight(PALETTE.warm, 14, 9, 2);
  warmGF.position.set(-0.8, 2.55, 0.2);
  building.add(warmGF);
  const warmFF = new THREE.PointLight(PALETTE.warm, 10, 8, 2);
  warmFF.position.set(-0.8, 5.9, -0.6);
  building.add(warmFF);
  // pink uplight into the tree canopy
  const treeSpot = new THREE.SpotLight(PALETTE.pink, 55, 6, 0.75, 0.6, 1.5);
  treeSpot.position.set(TX + 0.2, SOIL + 0.1, TZ + 0.5);
  treeSpot.target.position.set(TX, SOIL + 3.2, TZ);
  building.add(treeSpot, treeSpot.target);

  // ---------- reflective floor, shadow and pink glow pool ----------
  const FLOOR_FADE = 13;
  const reflector = new Reflector(new THREE.PlaneGeometry(60, 60), {
    clipBias: 0.003,
    textureWidth: 1024,
    textureHeight: 1024,
    color: 0xffffff,
    multisample: 4,
    shader: makeFadingReflectorShader(),
  });
  reflector.material.transparent = true;
  reflector.material.depthWrite = false;
  reflector.material.uniforms.strength.value = 0.62;
  reflector.material.uniforms.fadeRadius.value = FLOOR_FADE;
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = 0;
  reflector.renderOrder = 1;
  scene.add(reflector);

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ color: '#5a1d4c', opacity: 0.16, depthWrite: false }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.002;
  shadowPlane.receiveShadow = true;
  shadowPlane.renderOrder = 2;
  scene.add(shadowPlane);

  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 15),
    new THREE.MeshBasicMaterial({ map: poolTex, color: PALETTE.pink, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(-0.4, 0.004, 1.6);
  pool.renderOrder = 3;
  scene.add(pool);

  // centre the building on the turntable pivot
  building.position.set(0.9, 0, -0.5);
  const LIFT = 0.1;

  // ---------- framing ----------
  const view = { az: 36, el: 11, target: new THREE.Vector3(0, 3.0, 0.3), dist: 30 };
  function frame() {
    const parent = canvas.parentElement;
    const w = parent.clientWidth, h = parent.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : opts.pixelRatioCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const R = 8.6;                         // bounding radius of the model
    const fitV = (R * 1.55) / Math.tan(vfov / 2);
    const fitH = (R * 1.08) / Math.tan(hfov / 2);
    view.dist = Math.max(fitV, fitH);
    const portrait = camera.aspect < 0.8;
    view.target.y = portrait ? -1.3 : 3.0;
    view.target.x = portrait ? 0.4 : 1.1;
    camera.updateProjectionMatrix();
    const rw = Math.round(Math.min(1024, w * renderer.getPixelRatio() * 0.6));
    reflector.getRenderTarget().setSize(rw, Math.round(rw * h / w));
  }

  // ---------- motion ----------
  const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
  function setPointer(nx, ny) { pointer.tx = nx; pointer.ty = ny; }

  const clock = new THREE.Clock();
  let running = true;
  let raf = 0;
  const amp = opts.reducedMotion ? 0 : 1;
  const ease = (p) => 1 - Math.pow(1 - p, 3);

  function render() {
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 2.6);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;

    const intro = opts.reducedMotion ? 1 : ease(Math.min(1, t / 2.4));
    const idle = opts.reducedMotion ? 0 : Math.min(1, Math.max(0, (t - 1.4) / 2.5));

    root.rotation.y = THREE.MathUtils.degToRad(
      (1 - intro) * -16 + Math.sin(t * Math.PI * 2 / 26) * 10 * idle * amp + pointer.x * 6 * amp);
    root.position.y = LIFT - (1 - intro) * 0.6 + Math.sin(t * Math.PI * 2 / 7) * 0.06 * idle * amp;

    const az = THREE.MathUtils.degToRad(view.az + pointer.x * 3 * amp);
    const el = THREE.MathUtils.degToRad(view.el - pointer.y * 2.5 * amp);
    camera.position.set(
      view.target.x + Math.sin(az) * Math.cos(el) * view.dist,
      view.target.y + Math.sin(el) * view.dist,
      view.target.z + Math.cos(az) * Math.cos(el) * view.dist,
    );
    camera.lookAt(view.target);

    // gentle LED "breathing"
    const breathe = 1 + Math.sin(t * Math.PI * 2 / 5.5) * 0.07 * amp;
    haloMat.opacity = Math.min(1, 0.95 * breathe);
    for (const l of pinkWash) l.intensity = l.userData.base * breathe;

    renderer.render(scene, camera);
  }

  function loop() {
    if (!running) return;
    render();
    raf = requestAnimationFrame(loop);
  }

  frame();
  const ro = new ResizeObserver(() => frame());
  ro.observe(canvas.parentElement);
  loop();

  return {
    setPointer,
    pause() { running = false; cancelAnimationFrame(raf); clock.stop(); },
    resume() { if (running) return; running = true; clock.start(); loop(); },
    renderOnce: render,
    dispose() {
      running = false; cancelAnimationFrame(raf); ro.disconnect();
      renderer.dispose(); pmrem.dispose();
    },
  };

  // ---------- local builders ----------
  function glazingRun(x0, x1, y0, y1, z, bays) {
    box(M.glass, x0, x1, y0, y1, z - 0.01, z + 0.01, building, false);
    const step = (x1 - x0) / bays;
    for (let i = 0; i <= bays; i++) {
      const x = x0 + i * step;
      box(M.frame, x - 0.035, x + 0.035, y0, y1, z - 0.04, z + 0.05, building, false);
    }
    box(M.frame, x0, x1, y0, y0 + 0.06, z - 0.04, z + 0.06, building, false);
    box(M.frame, x0, x1, y1 - 0.06, y1, z - 0.04, z + 0.06, building, false);
  }

  function curtain(x0, x1, y0, y1, z) {
    const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 24, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin((x / (x1 - x0)) * Math.PI * 9) * 0.035);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M.curtain);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
    m.renderOrder = 4;
    building.add(m);
  }
}

// ---------- textures ----------
function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeGlowStripTexture() {
  return canvasTexture(16, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.46, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.54, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function makeRadialTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function makeWindowGlowTexture() {
  return canvasTexture(64, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffcf9a');
    g.addColorStop(0.5, '#b26a6e');
    g.addColorStop(1, '#4a2c3a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function makeArtTexture() {
  return canvasTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#f3ede8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f2a7cf';
    ctx.beginPath(); ctx.arc(w * 0.36, h * 0.55, h * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8fe0da';
    ctx.fillRect(w * 0.55, h * 0.2, w * 0.22, h * 0.6);
    ctx.strokeStyle = '#2d2a30'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.8); ctx.lineTo(w * 0.88, h * 0.8); ctx.stroke();
  });
}

function makeLeafTexture() {
  return canvasTexture(64, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, '#d9d9d9');
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w / 2, h);
    ctx.quadraticCurveTo(w * 1.02, h * 0.55, w / 2, 0);
    ctx.quadraticCurveTo(-w * 0.02, h * 0.55, w / 2, h);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,120,120,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.lineTo(w / 2, h * 0.06); ctx.stroke();
  });
}

function makeFadingReflectorShader() {
  return {
    name: 'FadingReflectorShader',
    uniforms: {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      strength: { value: 0.6 },
      fadeRadius: { value: 12 },
    },
    vertexShader: /* glsl */`
      uniform mat4 textureMatrix;
      uniform float fadeRadius;
      varying vec4 vUv;
      varying vec2 vLocal;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vUv = textureMatrix * vec4(position, 1.0);
        vLocal = position.xy / fadeRadius;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 color;
      uniform sampler2D tDiffuse;
      uniform float strength;
      varying vec4 vUv;
      varying vec2 vLocal;
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        vec4 base = texture2DProj(tDiffuse, vUv);
        float d = length(vLocal * vec2(1.0, 1.35));
        float fade = 1.0 - smoothstep(0.08, 1.0, d);
        gl_FragColor = vec4(base.rgb * color, base.a * fade * fade * strength);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
