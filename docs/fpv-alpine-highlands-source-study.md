# Alpine Highlands: original 4.096 km source study

This increment creates six connected mountain districts with different terrain and structures. It is an early source study, not the plan's final 8 km Alpine world, a Library release, or representative art acceptance. Existing maps, physics, scored courses, recordings and package limits are unchanged.

## What is different between districts

| District        | Terrain and original structures                                                            | Pilot route                                                         |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Glacial valley  | Broad low valley, unequal rock erratics, winding meltwater colour bands                    | Low passes between boulders and a broad valley exit                 |
| Switchback pass | Three road terraces with retaining foundations and connecting ramps                        | Traverse the terraces or follow the clear approach corridor         |
| Snow saddle     | High snow and scree slopes with unequal rock pinnacles                                     | Pass the narrow ridge gap, then follow the carved mountain approach |
| Summit station  | Two separate timber station wings, an open concourse, a supported lookout and cable pylons | Fly through the concourse and descend the linked valley             |
| Viaduct gorge   | A lowered gorge crossed by a 350 m deck with grounded piers and an open centre bay         | Fly beneath the deck or explore its elevated approaches             |
| Reservoir dam   | Separated dam faces, buttresses, maintenance galleries and a visible reservoir             | Follow the central spillway opening and surrounding valley          |

The 69 structural pieces and terrain are original deterministic geometry. Snow, scree and water surfaces follow explicit existing visual-only material rules; they do not add hidden collision walls. The structures are static: there is no functioning cable-car system, moving traffic or water physics. These are distinct layouts rather than copies of one courtyard, but their final visual quality still requires native review.

Official examples informed the activity mix only: [VelociDrone's scenery list](https://www.velocidrone.com/scenery) includes Alpine Lake; [TRYP's publisher description](https://store.steampowered.com/app/1881200/TRYP_FPV__The_Drone_Racer_Simulator/) describes mountain and long-range exploration; [Uncrashed's publisher description](https://store.steampowered.com/app/1682970/Uncrashed__FPV_Drone_Simulator/) emphasizes varied freestyle environments. No meshes, images, textures or map layouts were copied from those simulators. The emitted provenance identifies this project's original CC0 source.

## Reproduce and inspect

From the repository root, choose a new external output directory:

```sh
node authoring/fpv-worlds/regions/alpine-highlands/prepare.mjs /absolute/new/alpine-source
node authoring/fpv-worlds/regions/alpine-highlands/verify.mjs /absolute/new/alpine-source
node authoring/fpv-worlds/regions/alpine-highlands/verify-flight.mjs /absolute/new/alpine-source
```

Generation refuses an existing directory. Serve the exact output as `/alpine-study/` beside the repository's authoring tools, then open:

```text
authoring/fpv-worlds/regions/scenery-preview.html?manifest=/alpine-study/scenery/region.json&companion=/alpine-study/terrain/region.json&views=alpine
authoring/fpv-worlds/regions/flight-preview.html?manifest=/alpine-study/terrain/region.json&scenery=/alpine-study/scenery/region.json&profile=terrain-scenery-v1
```

Six authoring view buttons select actual verified local windows. The flight preview retains deliberate arming and the existing shared engine. The source is not automatically installed or added to the normal player catalogue.

## Verified source envelope

- 4,096 × 4,096 m; 256 terrain cells at 256 m and 8 m lattice spacing.
- 103 populated scenery cells and 153 explicitly empty scenery cells.
- 20,951,894 source bytes; no increase to the 64 MiB delivery limit.
- Conservative maximum retained plus candidate window: 2,000,576 resource bytes, below the unchanged 8 MiB geometry/texture allowance.
- 359 canonical GLBs validated with zero errors/warnings, 480 exact terrain seams, 1,578 swept corridor probes and 546 actual mixed-window preparations.
- Two actual structure hits, two elevated support checks, non-grid canonical terrain support checks, six safe authored starts and an explicit check that visual water neither supports nor blocks a drone.
- Production shared-session commands passed all258 route/mode cases (356,315 accepted ticks, 356 origin recentres),12 authored starts and4 intentional wall contacts. Commands adapt cruise speed to steep grades; no flight model or admission threshold changes. Maximum route height error was1.274m and lateral error0.086m. These are accelerated test commands, not a wall-clock endurance or device-FPS claim.
- All owned source, geometry and reservation counters return to zero after disposal.

Terrain manifest SHA-256: `ce45cfcfc2f5ae829c863a926e8b7aa8133bedb404ceff3df4e4ed9a5dfd93a3`.

Scenery manifest SHA-256: `692d5727473f4c99ec43e66fda667fe24112d174d89080409858a53d9a031fb7`.

The first exploratory clearance run correctly rejected an approach through a rock spire. A later flight and sweep both rejected a long downhill chord through the summit shoulder. The final approach avoids the spire and uses shorter terrain-following segments. Collision policy and admission thresholds were not weakened. Failed exploratory outputs remain external; the committed receipts identify only the final exact source.

## Remaining gates

Native six-view art review, normal-player install and cached reload, immutable delivery publication, packaging, all-device controls and sustained rendering performance are not proved by this source increment. The 129 commanded route segments cover the authored connected corridors; they do not claim that every arbitrary path is obstacle-free. Eight-kilometre expansion remains deferred until content variety and the existing budgets justify it.
