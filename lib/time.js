// Helpers for writing frames as pure functions of t.

export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, k) => a + (b - a) * k;

// 0 before `start`, 1 after `start + dur`, linear in between.
export const progress = (t, start, dur) => clamp((t - start) / dur);

export const ease = {
  linear: (k) => k,
  outCubic: (k) => 1 - (1 - k) ** 3,
  inOutCubic: (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  outExpo: (k) => (k >= 1 ? 1 : 1 - 2 ** (-10 * k)),
  inExpo: (k) => (k <= 0 ? 0 : 2 ** (10 * k - 10)),
  outBack: (k) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2,
};

// Index of the last beat at or before t (-1 before the first beat).
export function beatIndex(beats, t) {
  let lo = 0, hi = beats.length - 1, i = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] <= t) { i = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return i;
}
