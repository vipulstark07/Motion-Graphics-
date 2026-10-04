// Felt piano, heartbeat pulse and an ElevenLabs voiceover (voice: Darian), 96 BPM = 24 beats in 15 s.
// The VO take is cut at its pauses and each phrase is placed on a beat.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { track, bus, mix, lowpass, highpass, duck, master, sidechain,
  kick, hat, chord, impact, crash, riser, sweep, swish, piano, pianoChord } from '../../lib/synth.mjs';

const BPM = 96, B = 60 / BPM;
const at = (b) => b * B;

// Phrases of vo/take-b.mp3 as [start, end] seconds (from silencedetect at -38 dB), and the beat each one lands on.
export const VO = [
  { text: 'Four generations of builders.', span: [0.0, 1.511], beat: 1 },
  { text: 'Every trade…', span: [1.770, 2.445], beat: 4 },
  { text: 'one family.', span: [2.823, 3.508], beat: 5.5 },
  { text: 'Built to last a generation…', span: [3.941, 5.442], beat: 8 },
  { text: 'and now, built to be found.', span: [5.862, 7.531], beat: 11 },
  { text: '4G Construction.', span: [8.208, 9.428], beat: 16 },
  { text: 'Website by Sukiyo Designs.', span: [9.839, 11.744], beat: 18.5 },
];

const CHORDS = {
  Bm9: [123.47, 185.0, 220.0, 277.18, 293.66],
  Gmaj7: [98.0, 146.83, 185.0, 246.94, 293.66],
  DF: [92.5, 146.83, 220.0, 293.66, 369.99],
  Em9: [82.41, 123.47, 196.0, 293.66, 369.99],
  Asus: [110.0, 164.81, 220.0, 293.66, 329.63],
  A: [110.0, 164.81, 220.0, 277.18, 329.63],
  Dmaj9: [73.42, 110.0, 185.0, 277.18, 329.63, 440.0],
};

function loadVO(sampleRate) {
  const path = fileURLToPath(new URL('./vo/take-b.mp3', import.meta.url));
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length >> 2);
}

// First sample in [s0, s1) louder than -40 dB re peak: where the phrase actually starts.
function onset(x, sr, s0, s1, peak) {
  const thr = peak * 0.01, w = Math.round(0.005 * sr);
  for (let i = Math.max(0, Math.round(s0 * sr)); i < Math.round(s1 * sr); i += w) {
    let m = 0;
    for (let j = i; j < i + w; j++) m = Math.max(m, Math.abs(x[j] ?? 0));
    if (m > thr) return i / sr;
  }
  return s0;
}

export default function score({ duration, sampleRate }) {
  const out = track(duration, sampleRate);
  const vo = bus(out), music = bus(out), drums = bus(out), fx = bus(out);

  // ---- voiceover, phrase by phrase onto the grid
  const x = loadVO(sampleRate);
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  for (const p of VO) {
    const on = onset(x, sampleRate, p.span[0] - 0.05, p.span[1], peak);
    const from = Math.round((on - 0.04) * sampleRate), to = Math.round((p.span[1] + 0.15) * sampleRate);
    const dst = Math.round((at(p.beat) - 0.04) * sampleRate);
    const fadeIn = 0.005 * sampleRate, fadeOut = 0.03 * sampleRate;
    for (let i = from; i < to; i++) {
      const k = i - from, g = Math.min(1, k / fadeIn, (to - i) / fadeOut);
      const d = dst + k;
      if (d >= 0 && d < vo.L.length) { vo.L[d] += x[Math.max(0, i)] * g; vo.R[d] += x[Math.max(0, i)] * g; }
    }
  }
  highpass(vo, 70);

  // ---- heartbeat pulse on every beat, accents on the cuts
  const kicks = [];
  for (let b = 0; b < 24; b++) {
    const g = [0, 8, 11, 16].includes(b) ? 1 : b >= 20 ? 0.45 : 0.62;
    kick(drums, at(b), g);
    kicks.push(at(b));
  }
  for (let b = 4; b < 16; b++) {          // clock-like ticks on the offbeats: precision, craft
    hat(drums, at(b + 0.5), 0.14, 400 + b, 0.35);
    if (b >= 11) hat(drums, at(b + 0.25), 0.07, 500 + b, -0.35);
  }
  lowpass(drums, 9000);

  // ---- felt piano + pad: one chord per scene
  const scenes = [[0, 'Bm9', 4], [4, 'Gmaj7', 4], [8, 'DF', 3], [11, 'Em9', 3], [14, 'Asus', 1], [15, 'A', 1], [16, 'Dmaj9', 8]];
  for (const [b, c, len] of scenes) {
    pianoChord(music, at(b), CHORDS[c], b === 16 ? 0.55 : 0.4, at(len) + 1.2);
    chord(music, at(b), at(len), CHORDS[c].map((f) => f * 2), 0.16, { attack: 0.25, release: 0.4 });
  }
  // a sparse melody: one high note on the hook, the reveal, the work cut and the credit
  for (const [b, f] of [[2, 739.99], [3, 880.0], [6, 739.99], [9.5, 659.26], [12.5, 587.33], [18.5, 1174.66], [20, 880.0]]) piano(music, at(b), f, 0.2, 2.5, 0.2, 60 + b);
  lowpass(music, 7000);

  // ---- transitions
  impact(fx, at(0), 0.8, 1);
  sweep(fx, at(4.25), at(1), 70, 340, 0.12);            // pull-back to the laptop
  swish(fx, at(5.25), 0.5, 0.35, 7, -0.3);
  impact(fx, at(8), 0.55, 8);                           // cut to the dark work section
  for (const b of [8.5, 9.5, 10.5]) swish(fx, at(b), 0.28, 0.25, 20 + b * 2, 0.4);   // cards slide
  swish(fx, at(11), 0.4, 0.4, 30);                      // cut to the phone
  riser(fx, at(13), at(3), 0.22, 4);
  swish(fx, at(16), 0.55, 0.5, 40);                     // phone screen becomes the end card
  impact(fx, at(16), 1.0, 16);
  crash(fx, at(16), 4.5, 0.12, 3);
  lowpass(fx, 8000);

  // ---- mix: the music breathes with the pulse and ducks under the voice
  duck(music, kicks, 0.25, 0.25);
  sidechain(music, vo, 0.55, 0.03, 0.35);
  sidechain(fx, vo, 0.3, 0.03, 0.35);
  mix(out, vo, 1.0);
  mix(out, music, 0.55);
  mix(out, drums, 0.5);
  mix(out, fx, 0.55);
  master(out, 1.2);
  return [out.L, out.R];
}
