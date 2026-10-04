// "Twins": 128 BPM in F minor, 8 bars = exactly 15 s. Every hit here has a
// partner in index.html, placed on the beat grid measured from this audio.
import { track, bus, mix, lowpass, highpass, pingpong, duck, master,
  kick, hat, clap, tone, chord, impact, crash, riser, sweep, swish } from '../../lib/synth.mjs';

const BPM = 128, B = 60 / BPM;
const at = (b) => b * B;

//            bass     arp (16ths)                         pad
const BARS = [
  { bass: 87.31, arp: [349.23, 415.3, 523.25, 622.25], pad: [174.61, 207.65, 261.63, 311.13] }, // Fm7
  { bass: 69.3, arp: [277.18, 349.23, 415.3, 523.25], pad: [138.59, 174.61, 207.65, 261.63] },  // Dbmaj7
  { bass: 103.83, arp: [311.13, 415.3, 523.25, 622.25], pad: [207.65, 261.63, 311.13, 392.0] }, // Abmaj7
  { bass: 77.78, arp: [311.13, 392.0, 466.16, 587.33], pad: [155.56, 196.0, 233.08, 293.66] },  // Eb
];
const ARP = [0, 2, 1, 3, 2, 0, 3, 1];

export default function score({ duration, sampleRate }) {
  const out = track(duration, sampleRate);
  const drums = bus(out), bass = bus(out), arp = bus(out), pad = bus(out), fx = bus(out);
  const kicks = [];

  // ---- drums
  for (let b = 0; b < 32; b++) {
    if (b === 16 || b === 17) continue; // breath before the zoom-through
    const g = b >= 29 ? 0.55 : b % 4 === 0 ? 1 : 0.85;
    kick(drums, at(b), g);
    kicks.push(at(b));
  }
  for (let b = 4; b < 28; b++) {
    if (b === 16 || b === 17) continue;
    hat(drums, at(b + 0.5), 0.38, 100 + b);
    if ((b >= 8 && b < 16) || b >= 24) {
      hat(drums, at(b + 0.25), 0.16, 200 + b, -0.3);
      hat(drums, at(b + 0.75), 0.16, 300 + b, 0.3);
    }
  }
  for (const b of [9, 11, 13, 15, 19, 21, 23, 25]) clap(drums, at(b), 0.9, b);
  for (let s = 0; s < 6; s++) clap(drums, at(26 + s * 0.25), 0.25 + s * 0.1, 50 + s, s % 2 ? 0.3 : -0.3); // roll into the end

  // ---- bass: offbeat 8ths, bars 1-6
  for (let b = 4; b < 28; b++) {
    if (b === 16 || b === 17) continue;
    const f = BARS[Math.floor(b / 4) % 4].bass;
    tone(bass, at(b + 0.5), B * 0.45, f, 0.7, { type: 'saw', attack: 0.004, release: 0.06 });
  }
  tone(bass, at(28), at(4), 43.65, 0.7, { type: 'saw', attack: 0.01, release: 1.2 }); // F1 under the end card

  // ---- arp: 16ths everywhere except the end, which thins to 8ths
  for (let s = 0; s < 32 * 4; s++) {
    const b = s / 4, bar = Math.floor(b / 4);
    if (b >= 28 && s % 2) continue;
    const notes = BARS[bar % 4].arp, i = ARP[s % 8];
    const f = notes[i] * (s % 16 >= 8 && bar >= 2 ? 2 : 1);
    tone(arp, at(b), B * 0.22, f, 0.28, { type: 'pluck', pan: s % 2 ? 0.35 : -0.35 });
  }

  // ---- pad: from the modes section on, then a held Fm(add9) under the end card
  for (let bar = 2; bar < 7; bar++) chord(pad, at(bar * 4), at(4) - 0.02, BARS[bar % 4].pad, 0.5, { attack: 0.15, release: 0.25 });
  chord(pad, at(28), duration - at(28), [174.61, 207.65, 261.63, 392.0], 0.55, { attack: 0.02, release: 1.0 });

  // ---- fx: impacts at the cuts, ticks on the letters, swishes on the morphs
  for (const [b, g] of [[0, 1], [4, 0.7], [16.5, 0.6], [18, 0.8], [28, 1]]) impact(fx, at(b), g, b + 1);
  crash(fx, at(0), 2.2, 0.2, 1);
  crash(fx, at(18), 2.0, 0.18, 2);
  crash(fx, at(28), 3.5, 0.25, 3);
  sweep(fx, at(0), at(3), 1200, 140, 0.18);                   // hook: falling with the pull-back
  [698.46, 830.61, 1046.5, 1244.51, 1396.91, 1661.22]          // "Gemini", letter by letter
    .forEach((f, i) => tone(fx, at(4 + i * 0.5), 0.25, f, 0.22, { type: 'pluck', pan: i % 2 ? 0.4 : -0.4 }));
  [8.5, 10, 11.5, 13, 14.5, 15.5].forEach((b, i) => {           // dot morphs
    swish(fx, at(b), 0.32, 0.5, 70 + i, i % 2 ? 0.4 : -0.4);
    tone(fx, at(b), 0.3, [1046.5, 1244.51, 1396.91, 1567.98, 1864.66, 2093.0][i], 0.14, { type: 'pluck' });
  });
  riser(fx, at(14), at(2), 0.35, 4);
  sweep(fx, at(16.5), at(1), 90, 1600, 0.3);                    // dive into the star
  swish(fx, at(17.5), 0.5, 0.7, 90);                            // iris
  [523.25, 622.25, 698.46, 830.61, 1046.5]                      // tiles flipping
    .forEach((f, i) => tone(fx, at(20 + i * 0.5), 0.3, f, 0.2, { type: 'pluck', pan: (i - 2) * 0.25 }));
  for (const [b, i] of [[24, 0], [25, 1], [26, 2], [27, 3]]) {  // rapid-fire stabs
    chord(fx, at(b), B * 0.4, BARS[i].pad.map((f) => f * 2), 0.35, { attack: 0.003, release: 0.08 });
    swish(fx, at(b), 0.18, 0.4, 120 + i);
  }
  riser(fx, at(26), at(2), 0.4, 6);
  swish(fx, at(28), 0.45, 0.9, 130);                            // twins colliding
  sweep(fx, at(29.5), at(1), 1800, 2600, 0.06);                 // tagline types on

  // ---- processing
  lowpass(arp, (t) => (t < at(4) ? 500 + 5500 * (t / at(4)) ** 2 : t >= at(16) && t < at(18) ? 900 : 6000));
  pingpong(arp, at(0.75), 0.35, 0.28);
  lowpass(bass, 700);
  lowpass(drums, 10000); // keep the noise voices silky, not hissy
  lowpass(fx, 8000);
  lowpass(pad, 2600);
  highpass(pad, 140);
  for (const b of [arp, bass, pad]) duck(b, kicks, 0.65, 0.16);

  mix(out, drums, 1.0);
  mix(out, bass, 0.55);
  mix(out, arp, 0.5);
  mix(out, pad, 0.45);
  mix(out, fx, 0.8);
  master(out, 1.5);
  return [out.L, out.R];
}
