# Urban earthworks — companion terrain and scenery preparation

This is a 384 × 384 m authored geometry study for the regional mixed-owner pipeline.
It is not a large-world release, default catalogue entry or qualified player map.

The preparation retains the existing Urban buildings, openings and five licensed
Kenney props. It removes only the pinned original ground surface, then provides
terrain separately. Three shallow earthworks occupy clear spaces between the
buildings: a 6 m mill ridge, a 4 m yard ridge and a 2.5 m service berm. Building
foundations and both original spawn locations remain at their original height.
The central service road stays flat. This adds changes of altitude and approach
lines without hiding the existing openings or placing walls inside new hills.

## Exact companion contract

The output contains `terrain/region.json` and `scenery/region.json`. Both use the
existing `FPVRegionManifest.v1` format, identical region identity/revision, grid,
chunk identities/coordinates and spawn candidates. Each has its own nine cells
and eighteen local scene/collision assets. Each scene is canonical GLB compiled
from its matching collision input. The manifests are consumed as an explicit pair;
the scenery member no longer supports standalone flight over empty ground.

The source manifest and provenance are pinned by SHA-256. Every source asset is
verified against that manifest, and every original scene is checked against its
canonical collision geometry before conversion. Exactly the original `surface-0`
ground is removed. All other surface arrays and colours remain unchanged. The
original sources and their standalone scenery revision are preserved.

The output includes the original provenance, the existing Kenney City Industrial
CC0 receipt and the exact license text. New terrain is original authored work.
The committed preparation receipt records both manifest hashes and source/license
provenance; generated heavy assets remain in external authoring output.

## Authoring and verification

Prepare into a new directory with:

```sh
node authoring/fpv-worlds/regions/urban-bando/prepare-mixed.mjs <verified-urban-regional-output> <new-output>
node authoring/fpv-worlds/regions/urban-bando/verify-mixed.mjs <new-output>
```

Three suggested flight corridors connect the open road, the ridge/loading hall and
the mill ridge/atrium. They include EN/UK labels and authored waypoints in the
receipt. The verifier checks centre and both edges of each 4 m corridor with 250 mm
sphere sweeps against the actual prepared terrain and architecture. These are
geometry checks, not completed flights, scored routes or demonstration recordings.

Verification covers canonical scene/collision equality, exact terrain seams,
unchanged architecture foundations, the fourteen existing opening/solid probes,
roof versus ground support, absent duplicate scenery ground, both spawn supports,
route clearances and disposal. Separate source owners are used only for those
read-only geometry checks; production or authoring flight must use the combined
atomic owner rather than independently committing these two windows.

## Verification receipt — 14 October 2026

Two separate regenerations produced 42 byte-identical files. The 36 scene/collision
assets total 1,443,452 bytes. All eighteen canonical GLBs passed the Khronos validator
with zero warnings or errors. The checks retained 4,345 architecture triangles
and 95 non-ground surfaces, removed 76 ground triangles, and added 18,432 terrain
triangles with exact shared seams.

All fourteen original probes and 411 sphere sweeps across the three authored
corridors passed. Roof support at 12.4 m remained distinct from terrain at 0 m;
the mill ridge supported at 6 m while scenery correctly reported no ground
support there. The maximum observed committed terrain-plus-scenery geometry was
821,388 bytes. This excludes full JavaScript/GPU memory and the runtime transaction
peak while old and new windows coexist. Disposal returned geometry accounting to
zero. No actual commanded flight or visual art review is claimed by this receipt.

## Remaining

The runtime lane owns transactional pair adoption, combined old/new resource
accounting, required-cell recovery and actual commanded flight. This preparation
does not implement those contracts or claim their acceptance. Materials remain a
blockout, decoration is sparse, and no sustained device performance, offline
package, scoring or public release qualification is implied. The intended future
Urban region is larger; this delivered extent remains 384 m.
