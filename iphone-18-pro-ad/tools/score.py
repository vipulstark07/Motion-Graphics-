#!/usr/bin/env python3
"""Original score for the iPhone 18 Pro film.

Synthesised from scratch (no samples) and locked to assets/timeline.json:
every cut lands on the 120 BPM grid, the four aperture stops get a
mechanical click, and the end card resolves on a long Fmaj9 bloom.

    python3 tools/score.py            # writes assets/audio/score.wav
    ffmpeg -i assets/audio/score.wav -c:a libmp3lame -b:a 192k assets/audio/score.mp3
"""
import json
import os
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, "assets", "timeline.json")))

SR = 48000
DUR = float(TL["duration"])
N = int(SR * (DUR + 0.5))
BEAT = 60.0 / TL["bpm"]
rng = np.random.default_rng(1809)

L = np.zeros(N)
R = np.zeros(N)
SEND_L = np.zeros(N)  # reverb send
SEND_R = np.zeros(N)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def idx(t):
    return int(round(t * SR))


def add(sig, t, gain=1.0, pan=0.0, send=0.25):
    """Mix a mono signal in at time t with equal-power pan and a reverb send."""
    i = idx(t)
    if i >= N:
        return
    sig = sig[: N - i]
    a = (pan + 1) * np.pi / 4
    gl, gr = np.cos(a) * gain, np.sin(a) * gain
    L[i : i + len(sig)] += sig * gl
    R[i : i + len(sig)] += sig * gr
    SEND_L[i : i + len(sig)] += sig * gl * send
    SEND_R[i : i + len(sig)] += sig * gr * send


def env_adsr(n, a, d, s, r_, sustain_len=None):
    a, d, r_ = int(a * SR), int(d * SR), int(r_ * SR)
    hold = n - a - d - r_ if sustain_len is None else int(sustain_len * SR)
    hold = max(hold, 0)
    e = np.concatenate([
        np.linspace(0, 1, max(a, 1)) ** 2,
        np.linspace(1, s, max(d, 1)),
        np.full(hold, s),
        s * np.linspace(1, 0, max(r_, 1)) ** 2,
    ])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def onepole(x, cutoff):
    """Time-varying one-pole low-pass. cutoff: scalar or per-sample array (Hz)."""
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    k = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += k[i] * (x[i] - acc)
        y[i] = acc
    return y


# ---------------------------------------------------------------- voices

def pad_voice(freq, dur, bright=2400.0, detune=0.07, attack=1.2, release=1.4):
    """Detuned additive saw stack with a gentle spectral roll-off (a 'filter')."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for cents in (-detune * 100, 0.0, detune * 100):
        f = freq * 2 ** (cents / 1200)
        ph = rng.uniform(0, 2 * np.pi)
        h = 1
        while f * h < min(bright * 3, 12000):
            amp = (1 / h) * np.exp(-f * h / bright)
            out += amp * np.sin(2 * np.pi * f * h * t + ph * h)
            h += 1
    # slow shimmer
    out *= 1 + 0.06 * np.sin(2 * np.pi * 0.23 * t + rng.uniform(0, 6))
    out *= env_adsr(n, attack, 0.5, 0.85, release)
    return out / 3


def pluck(freq, dur=0.6, bright=3000.0, decay=4.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    h = 1
    while freq * h < 10000 and h < 24:
        amp = (1 / h) * np.exp(-freq * h / bright) * np.exp(-t * decay * (1 + 0.35 * h))
        out += amp * np.sin(2 * np.pi * freq * h * t)
        h += 1
    out *= np.minimum(1, t / 0.003)
    return out


def bell(freq, dur=2.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * freq * 3.5 * t) * 2.2 * np.exp(-t * 3)
    out = np.sin(2 * np.pi * freq * t + mod) * np.exp(-t * 1.6)
    out += 0.25 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 4)
    out *= np.minimum(1, t / 0.002)
    return out


def boom(dur=2.4, f0=96, f1=34, depth=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 9)
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.sin(ph) * np.exp(-t * 1.5) * depth
    click = rng.standard_normal(n) * np.exp(-t * 400) * 0.25
    return np.tanh((out + click) * 1.4)


def riser(dur, f_start=300, f_end=9000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    cut = f_start * (f_end / f_start) ** (t / dur)
    y = onepole(noise, cut) - onepole(noise, cut * 0.25)
    e = (t / dur) ** 2.4
    e[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return y * e * 1.6


def aperture_click():
    """Blade actuation: a tiny thud, a dry mechanical tick, a metallic ping."""
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    tick = (noise - onepole(noise, 3500)) * np.exp(-t * 260) * 0.9
    tick2 = np.roll((noise - onepole(noise, 5000)) * np.exp(-t * 300) * 0.5, int(0.028 * SR))
    ping = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in ((2140, 0.22, 16), (3410, 0.14, 22), (5230, 0.08, 30)))
    thud = np.sin(2 * np.pi * 70 * t) * np.exp(-t * 40) * 0.6
    return tick + tick2 + ping + thud


def hat(dur=0.09):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    return (noise - onepole(noise, 7000)) * np.exp(-t * 55)


def sub_pulse(freq, dur=0.42):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    return np.tanh(out * 1.5) * env_adsr(n, 0.008, 0.12, 0.55, 0.18)


# ---------------------------------------------------------------- arrangement

S = {s["id"]: s for s in TL["shots"]}

CHORDS = {
    "glint": ([38, 45], [62, 69]),  # open fifth drone
    "hero": ([38], [50, 53, 57, 60, 64]),  # Dm9
    "aperture": ([34], [46, 50, 53, 57, 60]),  # Bbmaj9
    "cameras": ([41], [57, 60, 64, 67]),  # Fmaj9
    "chip": ([38], [50, 53, 57, 60, 65]),  # Dm7 (add 11)
    "display": ([34], [50, 53, 57, 60, 62]),  # Bbmaj9 (6/9)
    "finishes": ([36], [52, 55, 57, 62, 64]),  # C6/9
    "endcard": ([29, 41], [57, 60, 64, 67, 69]),  # Fmaj9 bloom
}

# Pads + bass, crossfaded on every cut.
for sid, (bass, chord) in CHORDS.items():
    s = S[sid]
    start, end = s["start"], s["end"]
    last = sid == "endcard"
    dur = (end - start) + (0.6 if not last else 0.5)
    attack = 2.8 if sid == "glint" else (0.18 if not last else 0.08)
    bright = {"glint": 900, "hero": 2200, "aperture": 1500, "cameras": 2600, "chip": 3200, "display": 2400, "finishes": 2800, "endcard": 3400}[sid]
    release = 0.7 if not last else 4.2
    for i, m in enumerate(chord):
        v = pad_voice(hz(m), dur, bright=bright, attack=attack, release=release)
        add(v, start, gain=0.075, pan=(i / max(1, len(chord) - 1) - 0.5) * 0.9, send=0.55)
    for m in bass:
        v = pad_voice(hz(m), dur, bright=260, attack=attack, release=release, detune=0.03)
        add(v, start, gain=0.13, pan=0, send=0.1)

# Intro shimmer: high harmonics fading in over the glint.
t = np.arange(int(4.5 * SR)) / SR
shimmer = sum(np.sin(2 * np.pi * hz(m) * t + i) for i, m in enumerate([74, 81, 86, 93])) * (t / 4.5) ** 2 * 0.012
shimmer *= 1 + 0.4 * np.sin(2 * np.pi * 5.1 * t)
add(shimmer, 0, gain=1, pan=0.2, send=0.9)

# Risers into the big moments.
for t_hit, length in ((4.5, 2.2), (23.5, 1.6), (42.0, 2.4)):
    add(riser(length), t_hit - length, gain=0.12, pan=0, send=0.5)

# Hits on cuts.
for t_hit, depth, g in ((4.5, 1.0, 0.55), (9.5, 0.7, 0.32), (17.5, 0.7, 0.3), (23.62, 1.0, 0.5), (30.0, 0.6, 0.28), (36.0, 0.7, 0.3), (42.0, 1.0, 0.6)):
    add(boom(depth=depth), t_hit, gain=g, send=0.2)

# Aperture: one click per stop, plus a quiet ticking clock underneath.
for k in TL["aperture"]:
    add(aperture_click(), k["t"], gain=0.32, pan=0.25, send=0.35)
for i in range(int((17.5 - 10.0) / (BEAT / 2))):
    tt = 10.0 + i * BEAT / 2
    add(hat(0.05) * (0.6 if i % 2 else 1.0), tt, gain=0.05, pan=-0.3 if i % 2 else 0.3, send=0.15)


def arp(sid, t0, t1, step, notes, gain, bright, decay, oct_shift=12, pan_spread=0.6):
    n_steps = int(round((t1 - t0) / step))
    for i in range(n_steps):
        m = notes[i % len(notes)] + oct_shift
        swell = min(1.0, (i + 1) / 6)
        add(pluck(hz(m), 0.7, bright=bright, decay=decay), t0 + i * step, gain=gain * swell,
            pan=np.sin(i * 1.7) * pan_spread, send=0.45)


_, c = CHORDS["hero"]
arp("hero", 6.5, 9.5, BEAT / 2, [c[0], c[2], c[4], c[3]], 0.05, 1800, 5.0)
_, c = CHORDS["aperture"]
arp("aperture", 9.5, 17.5, BEAT, [c[4], c[2], c[3], c[1]], 0.035, 1400, 3.0)
_, c = CHORDS["cameras"]
arp("cameras", 17.5, 23.5, BEAT / 4, [c[0], c[1], c[2], c[3], c[2], c[1]], 0.04, 2600, 6.0)
_, c = CHORDS["chip"]
arp("chip", 23.5, 30.0, BEAT / 4, [c[0], c[2], c[4], c[3], c[1], c[4]], 0.05, 3800, 7.0, oct_shift=12)
_, c = CHORDS["display"]
arp("display", 30.0, 36.0, BEAT / 2, [c[4], c[2], c[3], c[1]], 0.045, 2400, 4.0)
_, c = CHORDS["finishes"]
arp("finishes", 37.0, 42.0, BEAT / 2, [c[0], c[2], c[4], c[3]], 0.04, 2600, 4.5)

# Chip section drive: 8th-note sub pulse, hats, and pad ducking.
duck = np.ones(N)
for i in range(int((30.0 - 23.5) / (BEAT / 2))):
    tt = 23.5 + i * BEAT / 2
    add(sub_pulse(hz(26 if i % 8 < 6 else 29)), tt, gain=0.22, send=0.05)
    add(hat(), tt + BEAT / 4, gain=0.06, pan=0.35, send=0.1)
    if i % 2 == 0:
        a = idx(tt)
        k = np.linspace(0.55, 1.0, int(0.22 * SR)) ** 0.7
        duck[a : a + len(k)] = np.minimum(duck[a : a + len(k)], k[: N - a])

# Finishes: a bell for each phone as it rises, then one per name.
for i, m in enumerate([76, 79, 81, 84]):
    add(bell(hz(m)), 36.15 + i * 0.16, gain=0.075, pan=-0.6 + i * 0.4, send=0.6)
for i, m in enumerate([64, 67, 69, 72]):
    add(bell(hz(m), 1.6), 37.4 + i * 0.14, gain=0.04, pan=-0.6 + i * 0.4, send=0.6)

# End card: sparkle over the bloom.
for i, m in enumerate([81, 88, 84, 91, 93]):
    add(bell(hz(m), 3.5), 42.0 + 0.5 + i * 0.5, gain=0.05 * (1 - i * 0.12), pan=np.sin(i * 2.1) * 0.6, send=0.8)

# ---------------------------------------------------------------- reverb + master

def impulse(seconds=3.4, seed=3):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t * 2.1)
    ir = onepole(ir, 9000 - 6000 * np.minimum(1, t / seconds))
    ir[: int(0.012 * SR)] = 0
    return ir / np.sqrt(np.sum(ir ** 2))


def convolve(x, h):
    m = len(x) + len(h) - 1
    nfft = 1 << (m - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)
    return y[: len(x)]


wet_l = convolve(SEND_L, impulse(seed=3)) * 0.9
wet_r = convolve(SEND_R, impulse(seed=4)) * 0.9
L = L * duck + wet_l
R = R * duck + wet_r

# gentle bus compression via soft clip, then normalise
mix = np.stack([L, R])
mix = np.tanh(mix * 1.15) / 1.15
mix = mix[:, : int(DUR * SR)]
fade = np.ones(mix.shape[1])
fo = int(1.2 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 1.6
mix *= fade
peak = np.max(np.abs(mix))
mix *= 10 ** (-1.0 / 20) / peak

out = os.path.join(ROOT, "assets", "audio", "score.wav")
pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(out, f"{mix.shape[1] / SR:.2f}s peak -1 dBFS")
