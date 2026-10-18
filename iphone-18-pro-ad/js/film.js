import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createPhone, createLockScreen, FINISHES } from './phone.js';
import { createChip } from './chip.js';

// "iPhone 18 Pro — Pro, in a new light."
// A 48-second product film rendered in real time. Every frame is a pure
// function of time, so the browser preview and the offline MP4 render match.

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');

// ---------- maths ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const range = (t, a, b) => clamp((t - a) / (b - a));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4);
const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mix3 = (a, b, k) => a.clone().lerp(b, k);

// ---------- boot ----------
const stage = document.getElementById('stage');
const glCanvas = document.getElementById('gl');
const textCanvas = document.getElementById('type');
const tctx = textCanvas.getContext('2d');

const timeline = window.__TIMELINE || (await (await fetch('assets/timeline.json')).json());
const DURATION = timeline.duration;
await Promise.all([
  document.fonts.load('600 64px InterAd'),
  document.fonts.load('500 28px InterAd'),
  document.fonts.load('700 64px InterAd'),
  document.fonts.load('400 14px InterAd'),
]);

const renderer = new THREE.WebGLRenderer({
  canvas: glCanvas,
  antialias: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: CAPTURE,
});
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 400);

// ---------- studio lighting (image-based) ----------
function buildEnvironment() {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(vec3(0.004 + 0.02 * smoothstep(-0.2, 1.0, h)), 1.0); }',
    }),
  );
  env.add(sky);
  const panel = (w, h, intensity, pos, color = '#ffffff') => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(16, 9, 2.4, [0, 14, 2]); // overhead softbox
  panel(2.4, 22, 6.0, [-12, 1, 4]); // key strip, left
  panel(1.6, 22, 3.6, [12, 0, -1]); // strip, right
  panel(24, 1.4, 5.0, [0, 3, -13]); // rear rim
  panel(18, 6, 0.9, [0, -3, 13]); // frontal fill
  panel(12, 5, 1.3, [-3, 9, 11]); // high front softbox
  panel(1.2, 14, 4.0, [5, 2, 13], '#fff4ee'); // narrow front kicker for glass
  panel(8, 8, 0.9, [-6, -10, -4]); // floor bounce
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0, 0.1, 100).texture;
  pmrem.dispose();
  return tex;
}
scene.environment = buildEnvironment();

// Soft glow behind the subject, drawn as a full-screen quad at the far plane.
const backdropMat = new THREE.ShaderMaterial({
  uniforms: {
    uColor: { value: new THREE.Color(0, 0, 0) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uRadius: { value: 0.5 },
    uAspect: { value: 16 / 9 },
  },
  depthWrite: false,
  depthTest: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
  fragmentShader: `
    uniform vec3 uColor; uniform vec2 uCenter; uniform float uRadius; uniform float uAspect;
    varying vec2 vUv;
    void main(){
      vec2 d = (vUv - uCenter) * vec2(uAspect, 1.0);
      float g = exp(-dot(d, d) / (uRadius * uRadius));
      gl_FragColor = vec4(uColor * g, 1.0);
    }`,
});
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backdropMat);
backdrop.frustumCulled = false;
backdrop.renderOrder = -10;
scene.add(backdrop);
function setBackdrop(r, g, b, cx = 0.5, cy = 0.5, radius = 0.5) {
  backdropMat.uniforms.uColor.value.setRGB(r, g, b);
  backdropMat.uniforms.uCenter.value.set(cx, cy);
  backdropMat.uniforms.uRadius.value = radius;
}

// ---------- cast ----------
const hero = createPhone('burgundy');
scene.add(hero.root);
const lockScreen = createLockScreen();
hero.setScreen(lockScreen, 0);

const lineupKeys = ['black', 'silver', 'glacier', 'burgundy'];
const lineup = lineupKeys.map((k) => {
  const p = createPhone(k, { screen: false });
  scene.add(p.root);
  return p;
});

const chip = createChip();
scene.add(chip.root);

// ---------- post ----------
const rt = new THREE.WebGLRenderTarget(16, 9, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(16, 9), 0.32, 0.6, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const finish = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uFade: { value: 1 },
    uTime: { value: 0 },
    uVignette: { value: 0.55 },
    uRes: { value: new THREE.Vector2(1920, 1080) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uFade; uniform float uTime; uniform float uVignette; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.85);
      c *= mix(1.0, smoothstep(0.85, 0.2, length(q)), uVignette);
      float n = hash(vUv * uRes + fract(uTime * 7.31) * 117.0) - 0.5;
      c += n * 0.014;
      gl_FragColor = vec4(c * uFade, 1.0);
    }`,
});
composer.addPass(finish);

// ---------- sizing ----------
let W = 1920;
let H = 1080;
function resize() {
  let w;
  let h;
  let ratio;
  if (CAPTURE) {
    w = Number(params.get('w') || 1920);
    h = Number(params.get('h') || 1080);
    ratio = 1;
  } else {
    const aw = window.innerWidth;
    const ah = window.innerHeight;
    w = Math.min(aw, (ah * 16) / 9);
    h = (w * 9) / 16;
    ratio = Math.min(window.devicePixelRatio || 1, 2, 2560 / w);
  }
  stage.style.width = `${w}px`;
  stage.style.height = `${h}px`;
  renderer.setPixelRatio(ratio);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(ratio);
  composer.setSize(w, h);
  W = Math.round(w * ratio);
  H = Math.round(h * ratio);
  textCanvas.width = W;
  textCanvas.height = H;
  finish.uniforms.uRes.value.set(W, H);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => {
  resize();
  if (!playing) renderFrame(clock);
});
resize();

// ---------- typography ----------
const FONT = '"SF Pro Display", "SF Pro", -apple-system, "InterAd", system-ui, sans-serif';
const S = () => W / 1920; // all type is specified at 1920 px wide

const STYLES = {
  title: { weight: 600, size: 140, track: -0.022, color: 'gradient' },
  headline: { weight: 600, size: 66, track: -0.02, color: '#f5f5f7' },
  sub: { weight: 500, size: 29, track: -0.005, color: '#a1a1a6' },
  item: { weight: 500, size: 27, track: -0.005, color: '#e8e8ed' },
  stat: { weight: 600, size: 96, track: -0.02, color: 'gradient' },
  label: { weight: 500, size: 25, track: 0, color: '#d2d2d7' },
  small: { weight: 500, size: 24, track: 0, color: '#f5f5f7' },
  legal: { weight: 400, size: 14, track: 0.002, color: '#6e6e73' },
};

function gradientFor(x0, x1, y) {
  const g = tctx.createLinearGradient(x0, y, x1, y);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#f6d3da');
  g.addColorStop(1, '#d66b80');
  return g;
}

/**
 * Draw one line of type with Apple-style motion: rise, de-blur, fade.
 * x, y are fractions of the frame. align: left | center | right.
 */
function text(str, t, { style = 'headline', x = 0.5, y = 0.5, align = 'center', t0, t1, rise = 26, blur = 10, inDur = 0.9, outDur = 0.45, alpha = 1 }) {
  if (t < t0 || t > t1 + 0.01) return;
  const st = STYLES[style];
  const s = S();
  const kin = easeOut(range(t, t0, t0 + inDur));
  const kout = 1 - easeInOut(range(t, t1 - outDur, t1));
  const a = kin * kout * alpha * globalTextAlpha;
  if (a <= 0.001) return;
  tctx.save();
  tctx.globalAlpha = a;
  tctx.font = `${st.weight} ${st.size * s}px ${FONT}`;
  tctx.letterSpacing = `${st.track * st.size * s}px`;
  tctx.textAlign = align;
  tctx.textBaseline = 'alphabetic';
  const b = (1 - kin) * blur * s + (1 - kout) * 4 * s;
  if (b > 0.2) tctx.filter = `blur(${b.toFixed(2)}px)`;
  const px = x * W;
  const py = y * H + (1 - kin) * rise * s;
  if (st.color === 'gradient') {
    const w = tctx.measureText(str).width;
    const left = align === 'center' ? px - w / 2 : align === 'right' ? px - w : px;
    tctx.fillStyle = gradientFor(left, left + w, py);
  } else {
    tctx.fillStyle = st.color;
  }
  tctx.fillText(str, px, py);
  tctx.restore();
}

function rule(t, { x, y, w, t0, t1 }) {
  const k = easeInOut(range(t, t0, t0 + 0.8)) * (1 - easeInOut(range(t, t1 - 0.4, t1)));
  if (k <= 0) return;
  tctx.save();
  tctx.globalAlpha = 0.28 * k * globalTextAlpha;
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(x * W, y * H, w * W * k, Math.max(1, S()));
  tctx.restore();
}

let globalTextAlpha = 1;

// ---------- shots ----------
const shots = timeline.shots;
const SHOT = Object.fromEntries(shots.map((s) => [s.id, s]));

function fNumberAt(t) {
  const move = timeline.apertureMove;
  let f = timeline.aperture[0].from;
  for (const k of timeline.aperture) {
    if (t >= k.t) {
      const e = easeInOut(range(t, k.t, k.t + move));
      // interpolate opening diameter (1/N), which is what the blades sweep
      f = 1 / lerp(1 / k.from, 1 / k.to, e);
    }
  }
  return f;
}
function fLabelAt(t) {
  let f = timeline.aperture[0].from;
  for (const k of timeline.aperture) if (t >= k.t + 0.08) f = k.to;
  return f === 4 ? '4.0' : String(f);
}

const tmp = new THREE.Vector3();
function look(pos, target, fov, near = 0.5) {
  camera.position.copy(pos);
  camera.lookAt(target);
  if (camera.fov !== fov || camera.near !== near) {
    camera.fov = fov;
    camera.near = near;
    camera.updateProjectionMatrix();
  }
}
function project(v) {
  tmp.copy(v).project(camera);
  return { x: (tmp.x + 1) / 2, y: (1 - tmp.y) / 2 };
}
function poseHero(px, py, pz, rx, ry, rz) {
  hero.root.position.set(px, py, pz);
  hero.root.rotation.set(rx, ry, rz);
  hero.root.updateMatrixWorld(true);
}
function mainLens() {
  return hero.lenses.main.getWorldPosition(new THREE.Vector3());
}

function show({ phone = false, lineupOn = false, chipOn = false }) {
  hero.root.visible = phone;
  lineup.forEach((p) => (p.root.visible = lineupOn));
  chip.root.visible = chipOn;
}

const SHOT_FNS = {
  // Light finds the edge of the plateau.
  glint(t, lt, p) {
    show({ phone: true });
    poseHero(0, 0, 0, 0.02, Math.PI + 0.08 - p * 0.16, 0);
    hero.setAperture(1.48, 0.4 + p);
    const L = mainLens();
    const e = easeInOut(p);
    look(
      mix3(v3(L.x + 2.6, L.y - 1.55, L.z + 2.2), v3(L.x + 1.55, L.y - 1.05, L.z + 1.95), e),
      mix3(v3(L.x + 0.5, L.y - 0.3, L.z - 0.1), v3(L.x + 0.25, L.y - 0.15, L.z), e),
      30,
      0.1,
    );
    scene.environmentRotation.set(0, lerp(-2.1, -0.5, e), 0);
    scene.environmentIntensity = 1.0;
    setBackdrop(0, 0, 0);
  },

  // The full reveal.
  hero(t, lt, p) {
    show({ phone: true });
    const turn = easeOutQuart(range(lt, 0, 4.2));
    poseHero(0, -1.15, 0, 0.07, Math.PI - 1.45 + turn * 1.72 + lt * 0.012, -0.02);
    hero.setAperture(1.48);
    look(v3(0, 0.2, lerp(53, 49.5, easeOut(p))), v3(0, -0.6, 0), 30);
    scene.environmentRotation.set(0, lerp(-0.9, 0.5, easeInOut(p)), 0);
    scene.environmentIntensity = 1.45;
    setBackdrop(0.05, 0.006, 0.014, 0.5, 0.55, 0.42);
    text('iPhone 18 Pro', t, { style: 'title', y: 0.165, t0: 5.6, t1: 9.25, inDur: 1.4, blur: 18 });
  },

  // Six blades, four stops.
  aperture(t, lt, p) {
    show({ phone: true });
    poseHero(0, 0, 0, 0, Math.PI, 0);
    const f = fNumberAt(t);
    hero.setAperture(f, 0.6 + p * 1.2);
    const L = mainLens();
    const e = easeInOut(p);
    const dist = lerp(5.3, 4.35, e);
    const sway = Math.sin(lt * 0.35) * 0.18;
    look(
      v3(L.x - 0.95 + sway, L.y + 0.12 - p * 0.18, L.z + dist),
      v3(L.x - 0.95 + sway * 0.4, L.y + 0.05, L.z),
      26,
      0.15,
    );
    scene.environmentRotation.set(0.15, lerp(2.4, 3.5, e), 0);
    scene.environmentIntensity = 1.1;
    setBackdrop(0, 0, 0);
    text('Our first', t, { style: 'headline', x: 0.085, y: 0.335, align: 'left', t0: 10.0, t1: 17.2 });
    text('variable aperture.', t, { style: 'headline', x: 0.085, y: 0.41, align: 'left', t0: 10.15, t1: 17.2 });
    text('Six laser-cut blades open and close', t, { style: 'sub', x: 0.0865, y: 0.48, align: 'left', t0: 10.6, t1: 17.2 });
    text('to shape light and depth of field.', t, { style: 'sub', x: 0.0865, y: 0.52, align: 'left', t0: 10.7, t1: 17.2 });
    rule(t, { x: 0.0865, y: 0.585, w: 0.22, t0: 11.0, t1: 17.2 });
    text(`ƒ/${fLabelAt(t)}`, t, { style: 'stat', x: 0.084, y: 0.72, align: 'left', t0: 11.1, t1: 17.2, blur: 6 });
    text('48MP Fusion Main camera', t, { style: 'label', x: 0.0865, y: 0.775, align: 'left', t0: 11.3, t1: 17.2 });
  },

  // The whole pro camera system.
  cameras(t, lt, p) {
    show({ phone: true });
    poseHero(0, 0, 0, 0, Math.PI + 0.1, 0);
    hero.setAperture(1.48, 1.4);
    const e = easeInOut(p);
    look(
      mix3(v3(6.4, 10.6, 12.8), v3(5.1, 9.5, 11.2), e),
      mix3(v3(3.35, 4.95, 0.3), v3(3.1, 5.05, 0.3), e),
      32,
    );
    scene.environmentRotation.set(0, lerp(0.4, 1.4, e), 0);
    scene.environmentIntensity = 1.05;
    setBackdrop(0, 0, 0);
    const x = 0.655;
    text('Pro cameras.', t, { style: 'headline', x, y: 0.33, align: 'left', t0: 18.0, t1: 23.2 });
    text('All 48MP.', t, { style: 'headline', x, y: 0.405, align: 'left', t0: 18.2, t1: 23.2 });
    const items = [
      ['48MP Fusion Main', 'with variable aperture'],
      ['48MP Ultra Wide', 'for macro and wide shots'],
      ['48MP Telephoto', 'up to 8x optical-quality zoom'],
    ];
    items.forEach(([a, b], i) => {
      const y = 0.5 + i * 0.095;
      const t0 = 18.8 + i * 0.28;
      rule(t, { x, y: y - 0.04, w: 0.28, t0, t1: 23.2 });
      text(a, t, { style: 'item', x, y, align: 'left', t0, t1: 23.2, rise: 14 });
      text(b, t, { style: 'sub', x, y: y + 0.037, align: 'left', t0: t0 + 0.1, t1: 23.2, rise: 14 });
    });
  },

  // A20 Pro.
  chip(t, lt, p) {
    show({ chipOn: true });
    const e = easeInOut(p);
    chip.update(lt, easeInOut(range(lt, 0.4, 2.0)));
    look(mix3(v3(1.6, 15.5, 8.5), v3(5.2, 7.2, 10.8), e), mix3(v3(-3.4, 0, 0.6), v3(-2.6, 0.2, 0.2), e), 32);
    scene.environmentRotation.set(0, lerp(-0.6, 0.5, e), 0);
    scene.environmentIntensity = 1.0;
    setBackdrop(0, 0, 0);
    text('A20 Pro', t, { style: 'title', x: 0.085, y: 0.44, align: 'left', t0: 24.4, t1: 29.75, inDur: 1.2 });
    text('Built on 2-nanometer technology.', t, { style: 'sub', x: 0.0875, y: 0.52, align: 'left', t0: 25.0, t1: 29.75 });
    text('Vapor cooled for sustained performance.', t, { style: 'sub', x: 0.0875, y: 0.56, align: 'left', t0: 25.2, t1: 29.75 });
  },

  // The front: a smaller Dynamic Island.
  display(t, lt, p) {
    show({ phone: true });
    const e = easeInOut(p);
    poseHero(0, 0, 0, 0.03, lerp(-0.36, -0.16, e), 0);
    const wake = easeOutExpo(range(lt, 0.5, 1.3));
    hero.setScreen(lockScreen, wake * 1.02);
    look(mix3(v3(-3.9, 1.0, 43), v3(-3.3, 4.4, 22.5), e), mix3(v3(-4.2, 1.0, 0), v3(-3.1, 4.4, 0), e), 30);
    scene.environmentRotation.set(0, lerp(-0.4, 0.3, e), 0);
    scene.environmentIntensity = 0.9;
    setBackdrop(0.022, 0.004, 0.009, 0.68, 0.5, 0.4);
    text('A smaller', t, { style: 'headline', x: 0.085, y: 0.42, align: 'left', t0: 31.2, t1: 35.75 });
    text('Dynamic Island.', t, { style: 'headline', x: 0.085, y: 0.495, align: 'left', t0: 31.35, t1: 35.75 });
    text('On a 6.3″ or 6.9″ ProMotion display', t, { style: 'sub', x: 0.0865, y: 0.575, align: 'left', t0: 31.9, t1: 35.75 });
    text('with Ceramic Shield 2.', t, { style: 'sub', x: 0.0865, y: 0.615, align: 'left', t0: 32.0, t1: 35.75 });
  },

  // Four finishes.
  finishes(t, lt, p) {
    show({ lineupOn: true });
    const spacing = 8.6;
    lineup.forEach((ph, i) => {
      const k = easeOutQuart(range(lt, 0.15 + i * 0.16, 1.9 + i * 0.16));
      ph.root.position.set((i - 1.5) * spacing, lerp(-5, -1.2, k), lerp(-6, 0, k));
      ph.root.rotation.set(0.04, Math.PI - 0.62 + k * 0.85 + lt * 0.018, 0);
      ph.root.updateMatrixWorld(true);
    });
    look(v3(0, 0.6, lerp(67, 64.5, easeOut(p))), v3(0, -0.9, 0), 30);
    scene.environmentRotation.set(0, lerp(0.1, 0.9, easeInOut(p)), 0);
    scene.environmentIntensity = 1.1;
    setBackdrop(0.03, 0.03, 0.034, 0.5, 0.52, 0.55);
    text('Color, through and through.', t, { style: 'headline', y: 0.135, t0: 36.5, t1: 41.75 });
    lineup.forEach((ph, i) => {
      const bottom = project(new THREE.Vector3((i - 1.5) * spacing, -1.2 - 7.5, 0));
      text(FINISHES[lineupKeys[i]].name, t, { style: 'label', x: bottom.x, y: Math.min(bottom.y + 0.06, 0.93), t0: 37.4 + i * 0.14, t1: 41.75, rise: 12 });
    });
  },

  // End card.
  endcard(t, lt, p) {
    show({ phone: true });
    poseHero(0, -2.55, 0, 0.06, Math.PI - 0.55 + easeOut(p) * 0.8, -0.015);
    hero.setScreen(lockScreen, 0);
    hero.setAperture(1.48);
    look(v3(0, 0, lerp(60, 57.5, easeOut(p))), v3(0, 0, 0), 30);
    scene.environmentRotation.set(0, lerp(0.6, 1.5, easeInOut(p)), 0);
    scene.environmentIntensity = 1.45;
    setBackdrop(0.055, 0.007, 0.016, 0.5, 0.6, 0.4);
    text('iPhone 18 Pro', t, { style: 'title', y: 0.165, t0: 42.5, t1: 48.5, inDur: 1.4, blur: 18 });
    text('Pro, in a new light.', t, { style: 'sub', y: 0.225, t0: 43.3, t1: 48.5 });
    text('Available now.', t, { style: 'small', y: 0.905, t0: 44.2, t1: 48.5 });
    text(
      'Concept film. Not affiliated with or endorsed by Apple Inc. iPhone is a trademark of Apple Inc., registered in the U.S. and other countries. Screen images simulated.',
      t,
      { style: 'legal', y: 0.965, t0: 44.6, t1: 48.5, rise: 0, blur: 0 },
    );
  },
};

function fadeAt(t) {
  let f = 1;
  for (const fd of timeline.fades) {
    if (fd.type === 'in') f = Math.min(f, easeInOut(range(t, fd.start, fd.end)));
    else if (fd.type === 'out') f = Math.min(f, 1 - easeInOut(range(t, fd.start, fd.end)));
    else if (t >= fd.start && t <= fd.end) {
      f = Math.min(f, t < fd.mid ? 1 - easeInOut(range(t, fd.start, fd.mid)) : easeInOut(range(t, fd.mid, fd.end)));
    }
  }
  return f;
}

function renderFrame(t) {
  t = clamp(t, 0, DURATION - 1e-4);
  const shot = shots.find((s) => t >= s.start && t < s.end) || shots[shots.length - 1];
  tctx.clearRect(0, 0, W, H);
  const fade = fadeAt(t);
  globalTextAlpha = fade;
  // The lock screen is only lit in the display shot.
  if (shot.id !== 'display') hero.setScreen(lockScreen, 0);
  const lt = t - shot.start;
  SHOT_FNS[shot.id](t, lt, lt / (shot.end - shot.start));
  finish.uniforms.uFade.value = fade;
  finish.uniforms.uTime.value = t;
  composer.render();
}

// ---------- playback ----------
const audio = document.getElementById('score');
const ui = {
  play: document.getElementById('play'),
  bar: document.getElementById('bar'),
  toggle: document.getElementById('toggle'),
  scrub: document.getElementById('scrub'),
  fill: document.getElementById('fill'),
  time: document.getElementById('time'),
  mute: document.getElementById('mute'),
  full: document.getElementById('full'),
};
let playing = false;
let clock = CAPTURE ? 0 : Number(params.get('t') || 0);
let wallStart = 0;
let clockStart = 0;

function now() {
  if (!playing) return clock;
  if (!audio.paused && !audio.muted && audio.readyState >= 2) return audio.currentTime;
  return clockStart + (performance.now() - wallStart) / 1000;
}

function fmt(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function updateUI() {
  if (CAPTURE) return;
  ui.fill.style.transform = `scaleX(${clock / DURATION})`;
  ui.time.textContent = `${fmt(clock)} / ${fmt(DURATION)}`;
  ui.toggle.dataset.state = playing ? 'playing' : 'paused';
}

function play() {
  if (clock >= DURATION - 0.05) clock = 0;
  playing = true;
  clockStart = clock;
  wallStart = performance.now();
  audio.currentTime = clock;
  audio.play().catch(() => {});
  document.body.classList.add('started');
  updateUI();
}
function pause() {
  clock = now();
  playing = false;
  audio.pause();
  updateUI();
}
function seek(t) {
  clock = clamp(t, 0, DURATION);
  clockStart = clock;
  wallStart = performance.now();
  audio.currentTime = clock;
  renderFrame(clock);
  updateUI();
}

function loop() {
  if (playing) {
    clock = now();
    if (clock >= DURATION) {
      clock = DURATION;
      playing = false;
      audio.pause();
    }
    renderFrame(clock);
    updateUI();
  }
  requestAnimationFrame(loop);
}

if (CAPTURE) {
  document.body.classList.add('capture');
  window.__duration = DURATION;
  window.__fps = timeline.fps;
  window.__renderFrame = (t) => {
    renderFrame(t);
    return new Promise((r) => requestAnimationFrame(() => r(true)));
  };
  window.__ready = true;
} else {
  ui.play.addEventListener('click', play);
  ui.toggle.addEventListener('click', () => (playing ? pause() : play()));
  ui.mute.addEventListener('click', () => {
    audio.muted = !audio.muted;
    if (!audio.muted && playing) audio.currentTime = clockStart + (performance.now() - wallStart) / 1000;
    ui.mute.dataset.state = audio.muted ? 'muted' : 'on';
  });
  ui.full.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });
  const scrubTo = (e) => {
    const r = ui.scrub.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * DURATION);
  };
  let dragging = false;
  ui.scrub.addEventListener('pointerdown', (e) => {
    dragging = true;
    ui.scrub.setPointerCapture(e.pointerId);
    scrubTo(e);
  });
  ui.scrub.addEventListener('pointermove', (e) => dragging && scrubTo(e));
  ui.scrub.addEventListener('pointerup', () => (dragging = false));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      playing ? pause() : play();
    } else if (e.code === 'ArrowRight') seek(clock + 2);
    else if (e.code === 'ArrowLeft') seek(clock - 2);
  });
  let idle;
  window.addEventListener('pointermove', () => {
    document.body.classList.add('active');
    clearTimeout(idle);
    idle = setTimeout(() => document.body.classList.remove('active'), 2200);
  });
  // Poster frame: the end card, until the viewer presses play.
  renderFrame(clock > 0 ? clock : 45.6);
  if (clock > 0) document.body.classList.add('started');
  updateUI();
  requestAnimationFrame(loop);
}
