# Round 07 generated visuals and inspection

12 September 2026. Two original visual artifacts were produced with the built-in image generation tool. Exact model version was not exposed. Both are concept-stage outputs; neither is a production sprite atlas or evidence of a working game.

## Compact FPV body

- [Body PNG](round-07-fpv-body.png)
- [Exact effective prompt](round-07-fpv-body-prompt.txt)
- Operation: new image, no reference image.
- Native output: `/Users/oleksandr.mekhovov/.codex/generated_images/01a09328-21d8-7e93-9403-7e6793a4fac2/exec-85910ba0-1811-471b-9f30-dcc2c617c095.png`.
- Measured output: 1254×1254 RGBA. Read-only alpha inspection found extrema 0–255 and 1,220,418 completely transparent pixels. The nontransparent bounding box `(31, 53, 1240, 1230)` includes faint stray pixels. No image manipulation was used for this inspection.

The image has an exposed dark X-frame, four motor hubs, olive battery, small blue/yellow accent, front camera and rear antenna. The front points upward. It deliberately omits propeller blades so the lab can animate rotors independently. No Z marking is visible. The generated texture is finer and softer than an ideal deliberate 32×32 source sprite; shrinking it is a motion-study compromise, not finished pixel cleanup. The source canvas is also not the occupied silhouette. Both issues remain for production export.

The lab's `assets/fpv-body.png` was checked byte-for-byte against this original and matches. Source SHA-256: `31a742f952415fb9dd2742eb9ba7ef1dc7a5aedca4593d817713c61932fe68c4`. Rendering the body with overlays does not modify either file.

Approximate normalized motor centers used to start rig alignment are `(0.19, 0.20)`, `(0.81, 0.20)`, `(0.19, 0.77)`, `(0.81, 0.77)`. These are visual estimates to inspect in playback, not measured engineering points. Pivots and offsets live in the lab preset and can be revised without regenerating the body or changing board geometry.

## Three terrain treatments

- [Comparison PNG](round-07-terrain-balance.png)
- [Exact effective prompt](round-07-terrain-balance-prompt.txt)
- Operation: edit using the inspected [Round 06 gameplay board](round-06-fpv-object-skins.png) as the sole image reference.
- Native output: `/Users/oleksandr.mekhovov/.codex/generated_images/01a09328-21d8-7e93-9403-7e6793a4fac2/exec-e57a2543-d5a8-4a7a-83a2-f4abaa7d8156.png`.

The result retains the prior daybreak railway scene and contrasts repeated small square glyphs, a mix of tiles and props, and larger detailed zones. The player is much smaller than in the earlier board. The first panel's X-like marks are terrain glyphs, not faction insignia. No Z markings are visible.

Limitations: the generator changed the panel interiors to portrait proportions, approximated rather than exactly preserved terrain footprints, and retained an abstract glowing quadcopter from the earlier composition. Its illustrated HUD values are not computed. The new independent FPV body is the motion-study character; this sheet is not its atlas. The live lab supplies exact 4:3 geometry and actual playback for comparison. Do not crop this composite into purported production assets or claim its three boards provide a gameplay-equivalence test.

The earlier images remain intact. The saved prompts distinguish a new source from an edited derivative. Playback findings and scope are recorded in [the lab review](../../authoring/evaluations/round-07-motion-lab-review.md).
