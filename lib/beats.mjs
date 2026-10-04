// Measures the beat grid of the audio that is actually heard.
// Onset envelope -> tempo by autocorrelation -> phase -> per-beat snap to onsets -> sample-level attack.
import { execFileSync } from 'node:child_process';

const SR = 22050, HOP = 256;

function onsetEnvelope(x) {
  const frames = Math.floor(x.length / HOP);
  const env = new Float32Array(frames);
  let prev = 0, lp = 0, prevLow = 0;
  for (let f = 0; f < frames; f++) {
    let e = 0, el = 0;
    for (let i = f * HOP; i < (f + 1) * HOP; i++) {
      lp += 0.05 * (x[i] - lp); // ~180 Hz one-pole low-pass: kicks and bass
      e += x[i] * x[i];
      el += lp * lp;
    }
    const le = Math.log1p(1000 * e / HOP), ll = Math.log1p(1000 * el / HOP);
    env[f] = Math.max(0, le - prev) + Math.max(0, ll - prevLow);
    prev = le; prevLow = ll;
  }
  return env;
}

// Frames are ~12 ms wide; find the attack inside one at ~1.5 ms resolution:
// the 32-sample block with the sharpest energy rise over the 4 blocks before it.
function refine(x, s0) {
  const BLK = 32, E = (k) => { let e = 1e-9; for (let i = k; i < k + BLK; i++) e += (x[i] ?? 0) ** 2; return e; };
  let best = s0, rise = -Infinity;
  for (let k = Math.max(0, s0 - HOP); k <= s0 + HOP; k += BLK) {
    const before = (E(k - 4 * BLK) + E(k - 3 * BLK) + E(k - 2 * BLK) + E(k - BLK)) / 4;
    const r = Math.log(E(k) / before);
    if (r > rise) { rise = r; best = k; }
  }
  return best;
}

export function measureBeats(audioPath, duration) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', audioPath, ...(duration ? ['-t', String(duration)] : []),
    '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length >> 2);
  const env = onsetEnvelope(x);
  const fps = SR / HOP, n = env.length;

  // Tempo: autocorrelation over 60-200 BPM, weighted toward ~120 BPM.
  let best = -Infinity, bestLag = 0;
  const ac = (lag) => { let s = 0; for (let i = lag; i < n; i++) s += env[i] * env[i - lag]; return s / (n - lag); };
  for (let lag = Math.floor((fps * 60) / 200); lag <= Math.ceil((fps * 60) / 60); lag++) {
    const bpm = (60 * fps) / lag;
    const w = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
    const s = ac(lag) * w;
    if (s > best) { best = s; bestLag = lag; }
  }
  const [a, b, c] = [ac(bestLag - 1), ac(bestLag), ac(bestLag + 1)];
  const lag = bestLag + (a - c) / (2 * (a - 2 * b + c) || 1);
  const period = lag / fps;

  // Phase: offset whose comb collects the most onset energy.
  let bestPhase = 0, bestScore = -Infinity;
  for (let p = 0; p < lag; p++) {
    let s = 0;
    for (let k = p; k < n; k += lag) s += env[Math.round(k)] || 0;
    if (s > bestScore) { bestScore = s; bestPhase = p; }
  }

  // Snap each grid beat to the strongest onset within +-40 ms.
  const win = Math.round(0.04 * fps), beats = [];
  for (let k = bestPhase; k < n; k += lag) {
    const c0 = Math.round(k);
    let bi = c0;
    for (let i = Math.max(0, c0 - win); i <= Math.min(n - 1, c0 + win); i++) if (env[i] > env[bi]) bi = i;
    beats.push(Math.round((refine(x, bi * HOP) / SR) * 1000) / 1000);
  }
  return { bpm: Math.round((60 / period) * 100) / 100, offset: beats[0] ?? 0, beats };
}
