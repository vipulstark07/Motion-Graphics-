# iPhone 18 Pro: "Pro, in a new light."

A 48-second 3D product film for **iPhone 18 Pro**, made in the style of Apple's launch films. The phone, the A20 Pro chip, the lighting, the type and the score are all generated in code. There are no stock assets or samples. Every frame comes from a timeline function, so the real-time browser version and the offline MP4 render are identical.

> Concept film. Not affiliated with or endorsed by Apple Inc. iPhone is a trademark of Apple Inc. The Apple logo is deliberately left out.

| File | What it is |
| --- | --- |
| `out/iphone-18-pro-film.mp4` | Final render: 1920×1080, 30 fps, H.264 + AAC stereo |
| `dist/iphone-18-pro-film.html` | Single self-contained file. Double-click to play in real time, with no server |
| `index.html` | The real-time film (development version, needs a static server) |

## The film

| Time | Shot | On screen |
| --- | --- | --- |
| 0:00 | **Glint**: macro of the Burgundy camera plateau as a light sweeps the lens ring | – |
| 0:04.5 | **Hero**: the phone turns from edge-on to the back | *iPhone 18 Pro* |
| 0:09.5 | **Aperture**: extreme close-up of the Main camera. The six-blade iris steps through ƒ/1.48 → ƒ/1.8 → ƒ/2.8 → ƒ/4.0 and back. Each stop has a mechanical click in the score. | *Our first variable aperture.* |
| 0:17.5 | **Cameras**: three-quarter view of the plateau | *Pro cameras. All 48MP.* |
| 0:23.5 | **A20 Pro**: the chip on its logic board, with light pulsing out through the traces | *A20 Pro. Built on 2-nanometer technology.* |
| 0:30 | **Display**: the Lock Screen wakes at 9:41 and the camera pushes in to the Dynamic Island | *A smaller Dynamic Island.* |
| 0:36 | **Finishes**: Black, Silver, Glacier and Burgundy rise into frame | *Color, through and through.* |
| 0:42 | **End card** | *iPhone 18 Pro / Pro, in a new light. / Available now.* |

## Research: what iPhone 18 Pro looks like

The base iPhone 18 isn't out yet; it's reported for spring 2027. The current "iPhone 18" is the **iPhone 18 Pro / Pro Max**, which Apple announced on 9 September 2026. The film is built to that hardware:

- **Design.** Aluminum unibody that carries over the iPhone 17 Pro shape, with a full-width camera plateau that's slightly thicker this year. The rear glass is now **color-matched** to the frame, so the phone is one tone instead of two. Modeled at the 6.3″ model's 150.0 × 71.9 × 8.75 mm.
- **Finishes.** Black, Silver, Glacier (an icy light blue) and the new hero color, Burgundy.
- **Cameras.** Three 48MP cameras in a triangle, with the flash, microphone and LiDAR stacked on the right. The **48MP Fusion Main** camera gets Apple's first variable aperture: **six laser-cut blades, four stops: ƒ/1.48, ƒ/1.8, ƒ/2.8, ƒ/4.0**. The 48MP Telephoto is 4x, with an 8x optical-quality crop.
- **Chip.** **A20 Pro**, built on a 2 nm process, with vapor-chamber cooling.
- **Display.** 6.3″ / 6.9″ ProMotion with a **smaller Dynamic Island**, behind Ceramic Shield 2.

Sources: Apple Newsroom ("Apple debuts iPhone 18 Pro and iPhone 18 Pro Max", Sept 2026), Apple tech specs, MacRumors, 9to5Mac, TidBITS, Macworld, Gizmodo and AppleInsider coverage of the launch.

## How it's built

- `js/phone.js`: the phone, built procedurally. The body outline uses superellipse corners (Apple-style continuous curvature), swept with a rounded edge profile. It also builds the plateau, buttons (Action, volume, side, Camera Control), USB-C, the color-matched glass panel, and the lens stacks: polished chamfers, iridescent coatings, sapphire covers, and a procedural **six-blade iris shader** whose opening scales with 1/N.
- `js/chip.js`: the A20 Pro package with a brushed (anisotropic) lid and animated trace pulses.
- `js/film.js`: the timeline, camera moves, type system (SF Pro Display where installed, Inter as the fallback), studio image-based lighting, bloom, vignette and grain.
- `assets/timeline.json`: shot boundaries, aperture cues and fades. The film and the score both read it, so picture and sound stay locked.
- `tools/score.py`: an original score synthesized with NumPy. It runs at 120 BPM so every cut lands on the beat, with pads, plucks, bells, risers, hits and aperture clicks, plus a convolution reverb.
- `tools/render.mjs`: renders the film frame by frame in headless Chromium and encodes it with ffmpeg.
- `tools/build-standalone.mjs`: inlines everything into `dist/iphone-18-pro-film.html`.

## Run / rebuild

```bash
# Watch in real time (from this folder)
npx serve .            # then open the printed URL
#   Space = play/pause, ←/→ = seek, ?t=12 jumps to 12 s

# Regenerate the score (needs Python 3 + NumPy)
python3 tools/score.py
ffmpeg -y -i assets/audio/score.wav -c:a libmp3lame -b:a 192k assets/audio/score.mp3

# Render the MP4 (needs Node, Playwright's Chromium and ffmpeg)
node tools/render.mjs --video --out out/iphone-18-pro-film.mp4
node tools/render.mjs --stills 7,12.2,26 --out stills/     # quick look-dev stills

# Rebuild the single-file version
node tools/build-standalone.mjs
```

Third-party: [three.js](https://threejs.org) r170 (MIT, `vendor/three/LICENSE`) and the [Inter](https://rsms.me/inter/) typeface (SIL OFL 1.1, `assets/fonts/LICENSE-Inter.txt`).
