# Urban surface readability study

The optional `urban` scenery surface profile adds original procedural material
detail to the existing Urban architectural study. `plain` remains the default.
It changes neither source assets nor mesh positions, normals, indices, colliders,
flight physics or readiness. It is not a public map or a completed art pass.

The four original architectural palettes receive concrete panel joints, masonry
courses, painted steel seams or corrugated roof sheet. Patterns use world metres
and fade below pixel resolution. World coordinates include the regional origin,
so a window change does not move the pattern. Broad, restrained weathering breaks
up flat faces without an image download or a new texture allocation.

Amber paint marks the loading hall's actual entrance borders and the actual
mill/parking shaft lips. The paint is confined to existing surfaces, so it cannot
look like a gate floating across an opening. It provides visual landmarks, not
mission completion or a claim that an approach is safe. Seven existing licensed
prop surfaces retain their palettes unchanged.

Materials are shared by the existing colour cache and disposed by the existing
owner. There are no extra meshes, vertices, textures, colliders or animation
callbacks. This does not prove unchanged GPU frame time: the optional fragment
shader has additional arithmetic and requires workload/device measurement before
default player admission.

## Review and checks

The existing authoring scenery preview accepts `&surface=urban` alongside its
manifest URL. Compare the same Warehouse doors, Mill atrium and Parking decks
views with that option absent. The explicit verified-source option is
`surfaceStyle: 'urban'`; an unknown style fails before source work begins.

```sh
node authoring/fpv-worlds/regions/verify-scenery-surface.mjs <verified-urban-regional-output>
node authoring/fpv-worlds/regions/verify-verified-scenery.mjs
```

The comparison verifies all 104 original meshes, including identical positions,
indices, normals and transforms; fourteen real sphere-query results are identical.
Both profiles account for 371,364 geometry bytes and dispose every material and
collider. The eleven existing verified-scenery cases cover source rejection,
cancellation, readiness, resource limits, retained frames and disposal.

Actual browser review on 14 October 2026 compared the same Warehouse, Parking and
Mill views with and without the profile. The shader compiled, brick/panel surfaces
and amber doorway borders were visible, and no console errors were observed. The
Warehouse view retained exactly 71 meshes and 243,516 geometry bytes. The amber
marking was useful but subtle; the scene still read as a flat, washed-out blockout.
This confirms a bounded material foundation, not the finished quality standard. The broader quality slice still needs lighting,
scenery density and sustained player/device qualification. These materials are
original procedural artwork; existing Kenney provenance is unchanged.
