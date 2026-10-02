# Training Hangar surface refinement

This is the first bounded C environment increment. The Hangar uses painted-steel
panels at a consistent physical scale, concrete slabs aligned with its existing
six-metre floor grid, and dark rubber on its existing service strips. All changes
are material or UV changes on existing geometry.

A fixed number of texture repeats previously stretched the same corrugation
across walls and ceiling beams of different sizes. The Hangar now projects a
six-by-three-metre tile, giving two-by-one-metre panels. Concrete wear primarily
varies surface roughness; subdued colour variation keeps the objective markers
prominent. The service strips use a non-emissive surface.

The implementation preserves every vertex, index, normal, object transform,
collider, gate, objective, actor route, fog distance and opening. Other worlds
retain their previous surface generators and UVs. The existing quality tiers
choose 128/256/512 texture sizes; Pixel retains 64-pixel nearest sampling.
Three rubber textures and one material are added to the existing world ownership
chain. No additional mesh, runtime file, download, decoder or theme preference
is introduced. This is original procedural artwork.

The decision follows the existing Three.js metallic/roughness workflow: surface
normal maps change lighting without moving geometry, while roughness maps
control the response to the existing environment light. See the official
[material documentation](https://threejs.org/docs/pages/MeshStandardMaterial.html)
and [texture repeat/filter documentation](https://threejs.org/docs/pages/Texture.html).

## Themes handoff

The separate Themes chat owns the unpublished shared appearance contracts and
selectors. This increment uses the current resolved palette only. When integrating
that work, retain these geometry-independent Hangar generators, metre-scale UVs,
normal/roughness maps and resource lifetime under the shared material factory.
Do not copy either branch's renderer or visual module wholesale. Broader hero
environment composition, artist-created assets and shared-theme integration
remain in C.

## Qualification

`docs/evidence/fpv-hangar-surfaces-model.json` records identical geometry and
transforms in all 14 worlds, exact material/UV data in the 13 other worlds, and
texture-tier/pixel filtering checks. It binds the visual source SHA256 and
baseline. Actual WebGL, package and offline evidence follows. Additional unit coverage stays in H/R7; human readability,
art acceptance and sustained device performance remain open.

The source and integrated browser receipts each pass **75/75 checks**. The
maintained comparison fixture covers30 image pairs across the three presets,
FPV/chase/overview poses and exact unchanged meadow pixels. Geometry, bounds,
transforms and ray distances remain equal. Three load/unload cycles plateau;
registered resources dispose. Balanced Hangar geometry remains108 registered
objects/51 GPU geometries, while materials rise68→69 and textures15→18
(12→15 GPU textures). No new shader program is required. These are resource
observations, not sustained FPS or physical-device measurements.

All154 v2 plus24 legacy demonstrations replay unchanged. The actual player
completes Lift and land, and the integrated launcher downloads/verifies World
Studio, reopens with its development origin stopped, and launches the Hangar
with Arm/resume enabled and no application errors. This tests origin
unavailability; it does not claim iPhone/PWA or OS-wide offline acceptance.
See the adjacent model, browser, integrated-browser, replay, legacy and offline
receipts.

Frozen candidate `294c9abe89e04cfb60b9e463dc88400832bace33` passes all three
optional-package admissions, committed-input and ZIP checks, and two identical
builds. Source counts35/68/100 and bytes545,596 /3,819,355 /14,067,328 remain
within the inherited #930 caps64/72/104 and8/8/16MiB. No guard or release
version is changed. See `evidence/fpv-hangar-surfaces-package.json`.

Published as [PR #956](https://github.com/mekhovov/revealline/pull/956) in native
stack957 after Garage #954. Publication remains a separate gate. Parent Garage #954's whole-edition
candidate currently exceeds the64MiB site guard by7,653 bytes; preserve the
guard and all content while repairing its transport before merging this child.

After newer main #908/#917 integration, linear candidate
`9134e9e210356ae4187fcde55337167e215ffabb` repeats all package checks; see
`evidence/fpv-hangar-surfaces-stack957-package.json`. The inherited failing
edition has no optional-practice files; the SIM does not cause its size excess.
