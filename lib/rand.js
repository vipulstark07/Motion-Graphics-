// Seeded randomness. Never Math.random() — render.mjs flags it.

// mulberry32: a stateful generator. Fine at load time for layout; never share
// one across seek() calls, or frame N depends on which frames were drawn before it.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stateless: the same (seed, i) always gives the same value in [0, 1).
// Safe to call inside seek(t).
export function hash(seed, i) {
  return mulberry32((seed ^ Math.imul(i | 0, 0x9e3779b1)) >>> 0)();
}

// Smooth 1D value noise in [0, 1). noise1(seed, t * speed) for organic drift.
export function noise1(seed, x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(seed, i) * (1 - u) + hash(seed, i + 1) * u;
}
