# Urban lighting and depth study

The optional `lighting=urban` authoring preview compares a more restrained light
rig against the existing plain inspection light. It is an appearance experiment,
not a default SIM environment or a finished quality standard.

The study lowers hemisphere fill, uses a warm directional sun and ACES tone mapping,
and enables one shadow map capped at 1024 × 1024. The shadow camera follows the
selected local inspection target: 220 m across for near architectural views and
520 m for the overview. Shadow detail therefore becomes coarser in overview.
It does not promise detailed shadows across an unlimited world.

The scene geometry, transforms, collision owners, source files and material profile
are unchanged. Meshes opt into casting/receiving shadows only in the study profile.
No image assets or extra geometry are added. Plain inspection keeps its existing
light and does not enable a shadow pass. A shadow pass adds rendering work and GPU
memory; the cap is not evidence of acceptable device frame time.

Use the existing scenery preview with a verified Urban manifest:

- `&surface=urban`: material foundation under the original inspection light.
- `&surface=urban&lighting=urban`: the same surfaces with the optional light rig.

The Release action disposes the shadow target and disables shadow casting before
redrawing the empty scene, preventing immediate replacement allocation. Loading a
new view re-enables casting. Final disposal removes the lights and target. The
existing owner remains responsible for all geometry/collision/material disposal.

`node authoring/fpv-worlds/regions/verify-scenery-lighting.mjs` checks both profiles,
unchanged geometry, bounded map configuration, target changes, empty-view release,
reload and repeated disposal. Actual GPU compilation and depth/readability are
reviewed separately in a native browser. No physical-device FPS, full GPU-memory
measurement or public-player performance acceptance is claimed.

The larger quality slice still needs landmark composition, environment density,
closer review of surface scale and sustained player/device testing. Lighting is
not a substitute for those tasks.

## Native review — 14 October 2026

Warehouse, Parking and Mill views rendered without browser console errors. Shadows
made the openings and decks visibly deeper. Geometry counts stayed unchanged:
Warehouse 71 meshes / 243,516 bytes; Parking 46 / 49,224; Mill 59 / 60,144. Release
showed the empty view and no live scenery/collision; Load restored the Overview
with nine cells, 104 meshes and 371,364 geometry bytes. This remains a visual and
lifecycle receipt, not measured physical-device performance or final art acceptance.
