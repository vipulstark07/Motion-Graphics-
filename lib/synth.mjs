// Tiny offline synth for scores and SFX. Everything is sample-accurate and
// seeded, so the same score.mjs always produces the same audio.
import { mulberry32 } from './rand.js';

const TAU = Math.PI * 2;

export function track(duration, sampleRate = 48000) {
  const n = Math.ceil(duration * sampleRate);
  return { sr: sampleRate, L: new Float32Array(n), R: new Float32Array(n) };
}

// Mixes fn(x) (x = seconds since t0) into the track with constant-power pan.
export function add(tr, t0, len, fn, pan = 0) {
  const s0 = Math.round(t0 * tr.sr);
  const n = Math.min(Math.round(len * tr.sr), tr.L.length - s0);
  const a = ((pan + 1) * Math.PI) / 4, gl = Math.cos(a), gr = Math.sin(a);
  for (let i = 0; i < n; i++) {
    const v = fn(i / tr.sr);
    tr.L[s0 + i] += v * gl;
    tr.R[s0 + i] += v * gr;
  }
}

export function kick(tr, t, gain = 1) {
  add(tr, t, 0.45, (x) =>
    gain * Math.sin(TAU * (45 * x + (110 * (1 - Math.exp(-30 * x))) / 30)) * Math.exp(-7 * x));
}

export function hat(tr, t, gain = 0.3, seed = 1, pan = 0.25) {
  const rnd = mulberry32(seed);
  let prev = 0;
  add(tr, t, 0.08, (x) => {
    const n = rnd() * 2 - 1, v = n - prev;
    prev = n;
    return gain * 0.5 * v * Math.exp(-70 * x);
  }, pan);
}

const waves = {
  sine: (f, x) => Math.sin(TAU * f * x),
  saw: (f, x) => { let s = 0; for (let h = 1; h <= 12; h++) s += Math.sin(TAU * f * h * x) / h; return s * 0.6; },
  pluck: (f, x) => (Math.sin(TAU * f * x) + 0.5 * Math.sin(TAU * 2 * f * x) + 0.25 * Math.sin(TAU * 3 * f * x)) * Math.exp(-6 * x),
};

export function tone(tr, t, len, freq, gain = 0.5, { type = 'sine', attack = 0.005, release = 0.1, pan = 0 } = {}) {
  add(tr, t, len, (x) => {
    const env = Math.min(1, x / attack) * Math.min(1, Math.max(0, (len - x) / release));
    return gain * env * waves[type](freq, x);
  }, pan);
}

// Low drop + noise burst, for cuts and slams.
export function impact(tr, t, gain = 0.8, seed = 7) {
  const rnd = mulberry32(seed);
  add(tr, t, 1.2, (x) =>
    gain * (Math.sin(TAU * (30 * x + (40 * (1 - Math.exp(-8 * x))) / 8)) * Math.exp(-3 * x) +
            0.4 * (rnd() * 2 - 1) * Math.exp(-25 * x)));
}

// Filtered-noise swell that ends exactly at t + len.
export function riser(tr, t, len, gain = 0.3, seed = 3) {
  const rnd = mulberry32(seed);
  let prev = 0;
  add(tr, t, len, (x) => {
    const n = rnd() * 2 - 1, v = n - prev;
    prev = n;
    return gain * v * (x / len) ** 2;
  });
}
