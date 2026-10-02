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

Source WebGL qualification passes211 checks and105 rendered comparisons: both
authored woodland bounds, three presets, FPV/chase/overview, heights1.5/3/6/9m,
Pixel filtering, actual GLB assets and exact pixel/material regression across all
13 other environments. Geometry, opaque faces and mesh ray distances remain
identical. Rays do not model alpha-mask holes or certify human target readability.

Three reload cycles plateau. Balanced Woodland retains234 registered geometries,
131 materials and29 textures (39 GPU geometries/17 textures); all owned resources
are released on disposal. No additional sampled draw calls or triangles appear.
These observations do not establish sustained FPS or device-memory performance.

The final player completes Crossing trail demonstration at49.4s. A separate
focused audit replays all19 woodland demonstrations across39,645 ticks. The six
existing square trunk colliders are unchanged; the closest recorded clearance is
2.81m. No route, actor behavior, medal or collision editing is included.

Frozen candidate `1ee7025eb9683c8d7ee0b6995cddd38b4bf6d058` passes all three
optional package admissions, committed-input and ZIP checks, with two identical
builds. Counts35/68/100 and545,596 /3,835,020 /14,089,806 bytes remain inside the
existing64/72/104-file and8/8/16MiB limits. Additional unit coverage remains in
H/R7. Named-device frame times, physical controllers, novice sessions and
production-art acceptance remain separate open work.

The 178 previously executed recordings remain applicable through exact equality
of all twelve recorded runtime/catalogue/proof inputs; see
`evidence/fpv-woodland-surfaces-replay-binding.json`. This binding is not a fresh
178-recording execution.

Packaged WebGL repeats211/211 checks and105 image comparisons using the
extracted frozen World Studio ZIP. Both normal reviewed-player and continuous-
school URLs now contain integrated main plus C4, with92files/13,932,487bytes
and identical ZIP SHA256
`fc3ddb63c13c02f36968f75d384a2e12fee932e10c8eefe6cc126affec92fe13`.
The dedicated woodland player remains paused at a ready Crossing trail flight.
