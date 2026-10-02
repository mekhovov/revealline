# Woodland bark and forest-floor surfaces

C4 is a bounded material pass for Woodland park. The six existing square tree
colliders keep their exact opaque faces and height. Coarse bark, restrained lichen
and a height-aligned base stain replace the fine timber grain. The existing ground
plane receives irregular soil, moss and leaf-litter variation instead of sharing
the Meadow grass surface.

This is original procedural artwork. It replaces the existing albedo, normal and
surface-property maps, without a new asset download or decoder. Normal maps alter
lighting rather than geometry, following the official Three.js
[material guidance](https://threejs.org/docs/pages/MeshStandardMaterial.html).
Existing texture tiers and sampling remain governed by the renderer's
[texture filtering](https://threejs.org/docs/pages/Texture.html) settings.

Keep every collider, route, gate, actor path, object transform, fog distance and
flight opening. This increment cannot make the six square silhouettes into
natural round trees; a future model change needs matching authored collision and
route qualification. Broad canopies inside the flight volume remain outside this
increment. The installed Kenney scenery and merged Meadow/Courtyard composition
are preserved.

## Shared Themes integration

Themes #955 owns the shared appearance system and material factory. Integrate
these narrow surface-kind/UV changes beneath that ownership; do not copy complete
renderer or visual files across branches. Preserve the merged Hangar surfaces,
Meadow grove placement and Courtyard terrace template. C4 adds no theme selector,
material factory or new appearance preference.

## Qualification

Qualification is in progress. Source and packaged browser evidence, resource
counts and frozen package admissions must be recorded before publication. Extra
unit coverage remains in H/R7. Named-device frame times, physical controllers,
novice sessions and production-art acceptance remain separate open work.

The 178 previously executed recordings remain applicable through exact equality
of all twelve recorded runtime/catalogue/proof inputs; see
`evidence/fpv-woodland-surfaces-replay-binding.json`. This binding is not a fresh
178-recording execution.
