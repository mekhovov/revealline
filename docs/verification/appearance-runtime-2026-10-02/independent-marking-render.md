# Independent Industrial marking render

On 2026-10-02 the published `industrial-gate-pad@r1` GLB was loaded by the
[Khronos glTF Sample Viewer](https://github.khronos.org/glTF-Sample-Viewer-Release/index.html),
which uses Khronos' separate Sample Renderer rather than the game's Three.js loader.
The [documented model URL parameter](https://github.com/KhronosGroup/glTF-Sample-Viewer/blob/main/README.md#url-parameters)
resolved the prior local-file-chooser limitation.

Exact model: [markings.glb at 5fbceaae5](https://raw.githubusercontent.com/mekhovov/revealline/5fbceaae5c9544af69f570f3a29771b42362aba2/authoring/fpv-worlds/industrial-markings/r1/markings.glb)
— 8,152 bytes, SHA-256
`57da4671dbb4c3a2aafb96785eb1bf83d14719106279e6fd0f9720800f9a5bf2`.
The model embeds the unchanged 981-byte atlas. No file was uploaded and no new
asset revision was created for this comparison.

## Observed results

- The ordinary shaded view displays four separate gate service plates with amber
  chevrons, the circular H/ring/orientation marking, and five neutral swatches.
  Transparent pad corners are absent, as intended by the alpha mask.
- The viewer's Validator reports **0 errors, 0 warnings, 0 infos**. Advanced
  statistics show **6 meshes / 12 triangles / 1 opaque material / 0 transparent
  materials**, consistent with the model's masked material and source receipt.
- Base Color diagnostic mode shows the expected steel/amber/enamel/ink palette
  and the five ordered grayscale patches. This diagnostic exposes the entire pad
  quad because it omits the normal alpha-mask treatment; it is not a defect in
  the ordinary shaded render.
- No error or warning was reported in the browser console during this load.

[Ordinary render and validator](marking-khronos-validator.png) ·
[Base Color diagnostic](marking-khronos-base-color.png).

This closes the **independent model decode and static appearance comparison**
that remained open in the earlier source-kit receipt. The initial Khronos view
used its default Cannon Exterior lighting and PBR Neutral mapping; the game's
preview uses ACES filmic exposure 1.08. These screenshots are not a pixel-equality
or matched-exposure certification. The Base Color view is a visual encoding check,
not a measured colorimeter result.

The earlier game-loader unlit wedge comparison remains a separate calibration
check. Actual packaged loading, in-flight placement, temporal sampling, protected
sightlines, target-device performance and a successor runtime collection still
need their own evidence before these marks are adopted in a player theme.
