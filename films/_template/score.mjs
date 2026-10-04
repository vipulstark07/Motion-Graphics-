// Synthesized score. render.mjs measures the beat grid from this audio into
// beats.json, and index.html places every visual hit on that measured grid.
import { track, kick, hat, tone, impact, riser } from '../../lib/synth.mjs';

const BPM = 120;

export default function score({ duration, sampleRate }) {
  const tr = track(duration, sampleRate);
  const beat = 60 / BPM, n = Math.floor(duration / beat);

  for (let k = 0; k < n; k++) {
    kick(tr, k * beat, k % 4 === 0 ? 1 : 0.75);
    hat(tr, k * beat + beat / 2, 0.35, k + 1);
  }
  const roots = [55, 55, 43.65, 49]; // A1 A1 F1 G1
  for (let bar = 0; bar * 4 * beat < duration; bar++)
    tone(tr, bar * 4 * beat, 4 * beat - 0.05, roots[bar % 4], 0.22, { type: 'saw', release: 0.15 });

  // Hits that the picture lands on: four word slams, then section cuts.
  [440, 523.25, 587.33, 659.25].forEach((f, k) => tone(tr, k * beat, 0.45, f, 0.3, { type: 'pluck', pan: k % 2 ? 0.3 : -0.3 }));
  for (const k of [6, 12, 18, 22]) impact(tr, k * beat, 0.8, k);
  riser(tr, 16 * beat, 2 * beat, 0.25);
  return [tr.L, tr.R];
}
