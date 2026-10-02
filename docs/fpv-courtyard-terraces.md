# Courtyard street-front composition

C3 arranges the courtyard's existing building modules into connected three-bay
terraces. Previously, twelve equally spaced four-metre bays left repetitive gaps
between every wall; larger school arenas spread those gaps further apart.

Each side now has four groups at deliberately uneven positions. Bays within a
group have a fixed 4.04 m pitch, with upper floors and roofs aligned to their
base. Setbacks vary between 8 and 12 m, leaving wider alleys between terraces.
Small creator courtyards with a side shorter than 64 m retain the previous layout
on that side. Flight bounds, obstacles, routes, objectives and actors are unchanged.

The pass retains all 139 scenery placements, the existing per-model assignments,
materials, textures and instancing groups. The embedded Kenney CC0 library remains
861,504 bytes with SHA256
`6153c9c7e5dbe571e91a1ba54d021a95bf618db13873e7e661f1ea593c71573e`.
Two offline regenerations are identical. The generated runtime grows by 801 bytes;
there is no new asset download, decoder or runtime file. The other five prepared
environment layouts retain exact placement data.

The existing instancing path remains intact. Three.js describes instancing as
sharing geometry and materials across transforms to reduce draw calls in its
[InstancedMesh documentation](https://threejs.org/docs/pages/InstancedMesh.html).
This increment changes the transforms, not that architecture. Measured render
observations and visual acceptance remain necessary; unchanged counts alone do
not prove unchanged performance or readable flight lines.

## Ownership and scope

Edit `authoring/fpv-worlds/scenery-runtime.template.mjs`, then regenerate through
the pinned offline preparation pipeline. Preserve provenance and the embedded
library hash. Shared Themes PR #955 continues to own appearance roles and
selectors; integrate the placement hunk without replacing its full generated
module. This increment does not change C2's meadow scenery or claim to complete
the broader realistic environment/asset work.

## Qualification

Functional verification covers all three courtyard bounds, actual GLB loading,
FPV/chase/overview rendering across quality presets, aligned tiers/roofs,
exterior clearance, other prepared worlds, resource cycling and replay identity.
Model qualification passes across all three authored courtyard extents. It
checks the actual GLB instance translations and encoded mesh bounds, 48 aligned
floor/roof stacks per layout, minimum 8 m building clearance, and exact geometry,
material and library identity. All five other prepared environments compare
byte-for-byte across their 11 bounds/theme variants. Prior 178-demonstration
results remain applicable through verified equality of every bound simulation,
catalogue and recording input; this is not labelled a new replay run. The actual
player also finishes the Roofline survey demonstration after 50.6 seconds.

Actual-GLB WebGL qualification passes 124 checks across 59 before/after image
pairs. The sampled courtyard views have unchanged peak draw calls of 215 / 355 /
450 and submitted triangles of 8,126 / 15,042 / 23,626 for Performance / Balanced /
Quality respectively; no sampled view adds draw calls. Three load cycles plateau
and registered geometry/material/texture allocations reach zero on disposal.
These are bounded rendering observations on the Codex browser, not sustained
device FPS. Added unit coverage remains in H/R7; human art acceptance and
physical-device performance remain open.
