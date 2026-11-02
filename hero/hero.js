import { mountBuilding } from './building.js';

const hero = document.querySelector('.hero');
const canvas = document.querySelector('.hero__canvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Glass cards: per-card parallax depth from data-depth
document.querySelectorAll('[data-depth]').forEach((el) => {
  el.style.setProperty('--d', el.dataset.depth);
});

let scene = null;
try {
  scene = mountBuilding(canvas, { reducedMotion });
} catch (err) {
  console.error('WebGL scene failed to start', err);
  canvas.remove();
}

// Pointer parallax shared by the 3D scene and the cards (eased in CSS + scene)
let frame = 0;
function onPointer(e) {
  const r = hero.getBoundingClientRect();
  const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
  const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
  if (scene) scene.setPointer(nx, ny);
  if (reducedMotion) return;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    hero.style.setProperty('--px', nx.toFixed(3));
    hero.style.setProperty('--py', ny.toFixed(3));
  });
}
hero.addEventListener('pointermove', onPointer, { passive: true });
hero.addEventListener('pointerleave', () => {
  if (scene) scene.setPointer(0, 0);
  hero.style.setProperty('--px', 0);
  hero.style.setProperty('--py', 0);
});

// Only render while the hero is on screen and the tab is visible
if (scene) {
  let visible = true;
  const sync = () => (visible && !document.hidden ? scene.resume() : scene.pause());
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.01 }).observe(hero);
  document.addEventListener('visibilitychange', sync);
}
