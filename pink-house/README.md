# Pink Residence: 3D house for your website

The pink-lit modern house from the Spline scene, packaged for a website.

| File | Use it for |
| --- | --- |
| `pink-house.html` | **Give this to Claude Design.** A single self-contained file with the 3D model embedded, plus the pink LED glow, lighting, soft floating shadow, slow sway/float and mouse parallax. Add `?transparent` to the URL to remove the preview gradient so the house floats on your page. |
| `pink-house.glb` | The raw 3D model (98 KB), for three.js, `<model-viewer>`, React Three Fiber, Spline, Blender and similar tools. LED strips are separate meshes named `LED_*` with a glowing pink material. |
| `pink-house-preview.png` | A picture of the look, so Claude Design can see it. |

## Prompt to paste into Claude Design

Upload `pink-house.html` and `pink-house-preview.png`, then paste:

> Design a modern website for a premium construction company. The hero section's centrepiece is
> the attached 3D house (`pink-house.html`): embed it as a full-width layer behind the hero content
> using `<iframe src="pink-house.html?transparent" style="border:0;width:100%;height:100%"
> title="3D house"></iframe>`, or reuse its `<script type="module">` on a canvas. Keep the house fully
> visible with breathing room around it. Style: pink neon lighting, pink-to-cyan gradient background,
> glassmorphism cards, bold white uppercase headline, pink call-to-action button. The preview image
> shows the look.

## Details

- About 120 boxes merged into 10 meshes plus 11 LED strips; no textures; three.js r160 from jsDelivr.
- Pixel ratio is capped (1.5 on phones). Rendering pauses when the house is off-screen or the tab is hidden.
- `?static` (or the visitor's reduced-motion setting) turns the motion off.
- Rebuild: `source/export.cjs` regenerates the `.glb` and `.html` from `source/house-model.js`
  and `source/viewer-template.html`.
