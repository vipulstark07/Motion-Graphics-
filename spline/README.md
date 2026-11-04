# Architectural Residence: Spline hero model

An editable 3D Spline scene of a modern minimalist residence, made for a
construction company's website hero section.

**Spline file:** https://app.spline.design/file/dcbce0d9-2ab2-4a2d-8f58-b2e4dfdf57a6

## The model

A three-level contemporary house on a thin limestone site plinth, shown as a
floating architectural object. Scale: 1 m ≈ 50 units, one storey ≈ 150 units.

| Element | Detail |
| --- | --- |
| Board-formed concrete core | A two-storey blade wall that anchors the composition |
| Ground-floor glass pavilion | Smoked glazing, graphite mullions with head/sill tracks, timber batten privacy screen |
| First-floor concrete box | Cantilevers 240 units (~4.8 m) over the pool; recessed glazing; graphite brise-soleil fins; rear ribbon window; side slot window |
| Penthouse | Charcoal standing-seam metal cladding, floor-to-ceiling glazing, thin overhanging roof slab |
| Roof terrace | Timber deck, frameless glass balustrade with a slim metal cap rail |
| Site | Pool with stone coping, timber deck, muted lawn panel, rear paver strip, dark shadow reveal under the plinth |

Everything is built from crisp primitives (`cornerRadius: 0`) with 7 shared
material assets, so you can restyle the whole model from the Assets panel:
`Concrete`, `Smoked Glass`, `Graphite`, `Clear Glass`, `Timber`,
`Limestone`, plus per-object cladding and water. All textures are drawn
procedurally at 512 px and tile seamlessly (board-formed concrete, standing seam,
timber decking). The polygon count is low: about 80 boxes.

### Palette

| Role | Hex |
| --- | --- |
| Concrete | `#c3beb6` |
| Limestone plinth | `#cdc8bf` |
| Charcoal cladding | `#2c2e31` |
| Graphite metal | `#3a3c40` |
| Smoked glass | `#1d272e` |
| Timber | `#8a735f` |
| Background (studio) | `#ece9e4` |

### Lighting

A warm key directional light (soft shadow radius 14), a cool shadowless fill,
a warm ambient fill, ambient occlusion, and an invisible **shadow catcher**
below the model. The catcher casts a soft floating shadow onto whatever
background the page uses.

## Motion

`hero-motion.html` is the scene's HTML layer, the same document that is in
the Spline file's Code tab. It drives the `Residence` group:

- a slow ±14° sway around the three-quarter hero angle (26 s period)
- a gentle ±7-unit float
- eased mouse parallax (±7° yaw, ±3.5° pitch)
- a 2.4 s rise-in entrance
- no motion when the visitor has `prefers-reduced-motion` set

Play controls are disabled (`playControls('none')`) so page scrolling never
zooms or orbits the model.

## Pink lighting version (current)

The scene is now restyled to match the pink neon reference:

- **Pink LED strips** (shared `Pink LED` emissive material) run along the front and right edges of
  both first-floor slabs, around the penthouse roof, around the plinth and along the pool edge.
- **3 shadowless pink point lights** wash the soffits, facade and terrace pink. A cyan rim light from
  the back-right echoes the cyan side of the reference.
- **Bloom** (threshold 0.9) makes only the LED strips glow; the white surfaces stay crisp.
- **Materials:** white render (`Concrete` → `#ebe6ec`), light-grey penthouse cladding, smoked glass
  with a warm interior glow and a pink fresnel rim, a cyan pool, and black frames.
- **Hero Camera** is fixed. It looks from the front-right (azimuth 35°, elevation 18°) so the
  cantilever over the pool reads clearly, and it is set as the Play/export camera.

### Web optimisation

| Metric | Value | Spline rating |
| --- | --- | --- |
| Objects | 47 (was 101) | good |
| Polygons | ~1.1k | good |
| Lights | 5, one shadow-casting | average |
| Textures | 3 procedural, 512 px | average |
| Post-processing | 1 (bloom) | good |

The 41 graphite frames, fins, tracks and rails are merged into one mesh (`Graphite Frames & Fins`).
The 12 timber battens are merged into another (`Timber Batten Screen`).

## Exporting for your website / Claude Design

Open the file, then **Export**:

- **Public URL or Viewer embed:** keeps everything, including the pink lights, bloom glow and the
  sway/float/mouse-parallax motion. Before exporting, turn off the background (Export → settings →
  Background / hide background) so the house floats on your site's own gradient.
- **3D file (GLB / glTF):** gives the geometry and materials, including the glowing pink LED strips,
  for use in other tools. Spline-only features don't come along: the bloom glow, point-light setup,
  shadow catcher and HTML motion layer. The receiving tool or site has to recreate those.
