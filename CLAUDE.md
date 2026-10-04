# Motion studio rules

These rules apply to every film in this repo. `render.mjs` enforces the ones a machine can check.

## Render contract

- Every film is a pure function of time: `window.seek(t)` paints frame `t`, for any `t`, in any order.
- No CSS transitions, no `setTimeout`, no `requestAnimationFrame` in render. No clocks (`Date.now`, `performance.now`).
- No state carried between frames. Build elements once at load; `seek(t)` sets every animated property from `t` alone.
- Seeded noise only (mulberry32, `lib/rand.js`), never `Math.random()`. Inside `seek` use the stateless `hash(seed, i)` / `noise1(seed, x)`.
- Render with `node render.mjs`, encoded H.264 yuv420p, CRF 16.

## Look

- Banned defaults: a centered title on a gradient, everything fading in, corner labels and frame borders, glow on UI chrome, generic particle backgrounds.
- One display face, one UI face. One accent color unless the brief says otherwise. Vendor font files into the film's `fonts/`.
- Every 2 to 4 seconds something new must happen on screen.

## Sound

- Score and SFX are synthesized in code (`score.mjs`, `lib/synth.mjs`) unless a track is supplied (`track.*`).
- Place hits on the measured beat grid (`beats.json`). Never hand-type beat times.
- Loudness: -14 LUFS integrated, true peak at or below -1 dBTP (normalized automatically).

## Loop before you show me anything

1. Render one frame per beat as a contact sheet (`--contact`) and LOOK at it.
2. Score it 1-10 in `scorecard.md` on: hook in first 2s, readability at phone size, motion quality, variety, brand accuracy, sound sync.
3. Fix the 3 worst problems.
4. Repeat until every score is 8+.
5. Only then do the full render. `render.mjs` refuses a full render until `scorecard.md` is all 8+.

## Layout of a film

```
films/<name>/
  film.json     { "width", "height", "fps", "duration" }
  index.html    defines window.seek(t); may fetch film.json and beats.json
  score.mjs     export default ({ duration, sampleRate }) => [left, right]   (or track.wav/mp3/...)
  beats.json    generated: measured from the audio actually heard
  scorecard.md  generated on first --contact; you fill it in each round
  out/          generated, gitignored: contact.png, beats/, frames/, <name>.mp4
```

Start a new film with `cp -r films/_template films/<name>`.

## Commands

```
npm install                                     # playwright (uses the preinstalled Chromium)
node render.mjs films/<name> --contact          # contact sheet: one frame per beat, at phone width (390px)
node render.mjs films/<name> --frames 0,1.25    # specific frames, full size, for close inspection
node beats.mjs films/<name>                     # re-measure beats.json (render.mjs does this when the audio changes)
node render.mjs films/<name>                    # full render -> out/<name>.mp4 (gated on scorecard.md)
```

Every run checks the contract: it flags `Math.random`, timers, rAF, clocks, and CSS transitions or animations during
`seek`, and in `--contact` it re-renders frames out of order and fails if any differ.
