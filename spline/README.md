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

## Remaining steps (in the Spline editor)

1. **Fix the hero camera:** the play camera (`Hero Camera`) is mis-aimed, so
   Play/export currently shows only background. Select it and aim it at the
   model from a raised three-quarter view: azimuth ≈ -35°, elevation ≈ 22°,
   looking at about (0, 150, 0). Or choose your viewport framing in
   Export → Camera.
2. **Make the background transparent:** Export → Settings → Background → set
   alpha to 0 (or toggle "Hide background"). The shadow catcher still
   grounds the model.
3. **Publish:** Export → Viewer or Code export. Paste the snippet Spline gives
   you into the hero section and give the container a fixed aspect ratio.
   The HTML motion layer ships with the export automatically.
