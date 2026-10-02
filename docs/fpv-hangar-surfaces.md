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
baseline. Actual WebGL, package and publication evidence is recorded separately
below once complete. Additional unit coverage stays in H/R7; human readability,
art acceptance and sustained device performance remain open.
