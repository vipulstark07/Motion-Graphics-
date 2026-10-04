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

// ---------- buses and processing ----------

// An empty track the same length as `tr`, for processing a group of sounds together.
export const bus = (tr) => ({ sr: tr.sr, L: new Float32Array(tr.L.length), R: new Float32Array(tr.R.length) });

export function mix(dst, src, gain = 1) {
  for (let i = 0; i < dst.L.length; i++) { dst.L[i] += src.L[i] * gain; dst.R[i] += src.R[i] * gain; }
}

// Two-pole low-pass in place. `cutoff` is Hz or a function of time in seconds.
export function lowpass(tr, cutoff) {
  const f = typeof cutoff === 'function' ? cutoff : () => cutoff;
  for (const ch of [tr.L, tr.R]) {
    let a = 0, b = 0;
    for (let i = 0; i < ch.length; i++) {
      const k = 1 - Math.exp((-2 * Math.PI * f(i / tr.sr)) / tr.sr);
      a += k * (ch[i] - a);
      b += k * (a - b);
      ch[i] = b;
    }
  }
}

// One-pole high-pass in place.
export function highpass(tr, cutoff) {
  const k = Math.exp((-2 * Math.PI * cutoff) / tr.sr);
  for (const ch of [tr.L, tr.R]) {
    let lp = 0;
    for (let i = 0; i < ch.length; i++) { lp = (1 - k) * ch[i] + k * lp; ch[i] -= lp; }
  }
}

// Stereo ping-pong delay in place: echoes alternate L, R, L... each `feedback` quieter.
export function pingpong(tr, time, feedback = 0.4, wet = 0.3) {
  const d = Math.round(time * tr.sr), n = tr.L.length;
  const inL = new Float32Array(n), inR = new Float32Array(n), outL = new Float32Array(n), outR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    outL[i] = i >= d ? inL[i - d] : 0;
    outR[i] = i >= d ? inR[i - d] : 0;
    inL[i] = (tr.L[i] + tr.R[i]) / 2 + feedback * outR[i];
    inR[i] = feedback * outL[i];
  }
  for (let i = 0; i < n; i++) { tr.L[i] += outL[i] * wet; tr.R[i] += outR[i] * wet; }
}

// Sidechain-style pump: dips the bus at each hit time and recovers over `release`.
export function duck(tr, hits, depth = 0.6, release = 0.2) {
  const sorted = [...hits].sort((a, b) => a - b);
  let h = -1;
  for (let i = 0; i < tr.L.length; i++) {
    const t = i / tr.sr;
    while (h + 1 < sorted.length && sorted[h + 1] <= t) h++;
    const g = h < 0 ? 1 : 1 - depth * Math.exp(-(t - sorted[h]) / release);
    tr.L[i] *= g; tr.R[i] *= g;
  }
}

// Peak-normalize, then soft-clip with tanh so transients stay round before loudnorm.
export function master(tr, drive = 1.6) {
  let peak = 1e-9;
  for (let i = 0; i < tr.L.length; i++) peak = Math.max(peak, Math.abs(tr.L[i]), Math.abs(tr.R[i]));
  const g = drive / peak, out = Math.tanh(drive);
  for (let i = 0; i < tr.L.length; i++) { tr.L[i] = Math.tanh(tr.L[i] * g) / out; tr.R[i] = Math.tanh(tr.R[i] * g) / out; }
}

// ---------- more voices ----------

export function clap(tr, t, gain = 0.5, seed = 5, pan = 0) {
  const rnd = mulberry32(seed);
  let p1 = 0, p2 = 0;
  add(tr, t, 0.35, (x) => {
    const n = rnd() * 2 - 1, hp = n - p1; p1 = n;
    p2 += 0.45 * (hp - p2); // band-limit the top
    const bursts = x < 0.03 ? Math.exp(-((x % 0.01) * 300)) : Math.exp(-(x - 0.03) * 14);
    return gain * p2 * bursts;
  }, pan);
}

export function crash(tr, t, len = 2.5, gain = 0.35, seed = 9) {
  const rl = mulberry32(seed), rr = mulberry32(seed + 1);
  const s0 = Math.round(t * tr.sr), n = Math.min(Math.round(len * tr.sr), tr.L.length - s0);
  let pl = 0, pr = 0;
  for (let i = 0; i < n; i++) {
    const x = i / tr.sr, env = gain * Math.exp(-x * (3.2 / len) * 2) * Math.min(1, x * 400);
    const a = rl() * 2 - 1, b = rr() * 2 - 1;
    tr.L[s0 + i] += (a - pl) * env; tr.R[s0 + i] += (b - pr) * env;
    pl = a; pr = b;
  }
}

// Detuned supersaw chord with slow attack, for pads.
export function chord(tr, t, len, freqs, gain = 0.2, { attack = 0.08, release = 0.3, detune = [0.993, 1, 1.007] } = {}) {
  freqs.forEach((f, i) => detune.forEach((d, j) =>
    tone(tr, t, len, f * d, gain / (freqs.length * detune.length) * 2, { type: 'saw', attack, release, pan: (j - 1) * 0.6 + (i % 2 ? 0.1 : -0.1) })));
}

// Pitch glide (sine), for whooshes and drops.
export function sweep(tr, t, len, f0, f1, gain = 0.3, pan = 0) {
  add(tr, t, len, (x) => {
    const k = x / len, ph = TAU * len * (f0 * k + ((f1 - f0) * k * k) / 2);
    return gain * Math.sin(ph) * Math.sin(Math.PI * Math.min(1, k)) ** 2;
  }, pan);
}

// Short filtered-noise swish centred on t (peaks at t), for morphs and wipes.
export function swish(tr, t, len = 0.35, gain = 0.25, seed = 11, pan = 0) {
  const rnd = mulberry32(seed);
  let lp = 0;
  add(tr, t - len * 0.7, len, (x) => {
    const k = x / len, cut = 0.04 + 0.5 * k;
    lp += cut * (rnd() * 2 - 1 - lp);
    return gain * lp * 3 * (k < 0.7 ? (k / 0.7) ** 2 : Math.exp(-(k - 0.7) * 12));
  }, pan);
}
