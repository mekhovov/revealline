# Canyon: six bounded authored districts

This source-only increment extends the accepted 384 × 384 m arrival pair to an
actual **768 × 768 m**, six-district terrain/scenery study. It preserves every
existing arrival asset byte-for-byte. It does not update the installed Library
preview, its delivery descriptor, or any runtime geometry/physics/resource limits.
The 8,192 m design target is not delivered by this increment.

## What pilots can practice in the study

- Arrival Basin retains the broad circuit, twin-spire passage and ridge arch.
- Red Mesa adds an elevated contour and distinctive terrace/overlook landmarks.
- Serpentine Gorge continues the winding low channel south of the old boundary.
- Twin Buttes adds a figure-eight around two separate hills, crossing at a saddle.
- Split Ravine provides a narrow alternate branch and a recognizable exit skyline.
- Sunset Shelf adds a long high contour with an approach and turnaround reference.

There are six authored starts and 54 licensed rock formations, including the
27 unchanged arrival formations. New locations were chosen around route purpose;
no runtime random generation or repeated empty tiles are introduced. The existing
sediment presentation remains optional and geometry-independent. The landscape is
still stylized and visibly coarse, not a completed realism benchmark.

## Exact source and verification

Regenerate with `prepare-districts.mjs <accepted-rounded-pair> <new-output>`.
The accepted parent manifests are pinned in the generator. Both output manifests
use revision `district-r3`; each contains 36 cells and 72 source assets. All cells
remain 128 m with the existing 33 × 33 samples / 4 m terrain spacing. The whole
pair contains 144 source assets totaling 3,336,288 bytes before manifests/receipts.

Terrain manifest: `219b438a19fdd7decd022cd48d145b1a45505198e86e9270cf818696894210a4`.
Scenery manifest: `3b704a760c06c7ed066e11050cadcb1af27d5ad18ed87e63e2a66137507fcff6`.

`verify-districts.mjs <accepted-rounded-pair> <new-output>` passes 72 canonical
GLB validations, preservation of all 36 arrival assets, all 60 adjacent seams,
9,888 corridor sweeps, and all 54 formations' grounding and actual solid support.
Queries use the production verified mixed owner with 200 bounded window changes;
peak observed resident geometry is 673,464 bytes. Six starts have clear takeoff
and correct terrain support. Release returns owned geometry to zero.

`verify-commanded-flight.mjs <new-output> districts` runs the actual production
regional session in Self-level and Acro. It passes 24 routes / 123,566 ticks,
72 in-flight origin changes, zero route contacts, 12 disarmed authored-start checks,
and four deliberate solid-contact cases. Maximum cross-track error is 0.403 m;
maximum altitude error is 0.334 m. Pause holds the entire snapshot and disposal
leaves no geometry/texture ownership. These controlled commands are automated
proof, not a human skill assessment or sustained rendering measurement.

The unchanged legacy arrival profile also passes its 14 routes / 34,798 ticks.
Deterministic regeneration matches all 149 files. Rejected draft outputs remain
preserved externally: the first figure-eight leg cut across the south butte and
was rerouted around its actual slope; a deeply buried gorge rock was relocated
to a suitable skyline. No terrain was flattened to conceal these defects.

The source remains the already-preserved CC0 Canyon Terrain Asset by loafbrr_1,
with the unchanged archive/model hashes and upstream receipt under `source/`.
No additional asset license is assumed. See the checked-in preparation, canonical
verification, commanded-flight and deterministic receipts alongside the generator.

## Scaling beyond this study

The existing strict v1 format admits only 128 m cells. A 4.096 km square would
need 1,024 cells / 2,048 assets per layer / 4,098 paired delivery files, within
current count caps. At the measured terrain density it projects 49.45 MiB for
terrain alone; the present total source density projects about 90.50 MiB, exceeding
the existing 64 MiB delivery ceiling before manifests. This is an estimate, not a
built world. Meaningful sparse scenery could reduce that budget; no cap is raised.

An 8.192 km square using the same cells would need 4,096 cells and 8,192 assets
per layer, exceeding the 4,096-asset manifest cap. Its paired 16,386 files also
exceed the 8,194-file delivery cap, while terrain GLBs alone are about 150 MiB.
A separately qualified larger-cell capability (for example 256 m with 33² samples,
8 m terrain spacing) could trade fine relief for coverage. It is not supported by
this increment and needs independent seam, slope, collision, residency and
prefetch qualification. These are current-contract limits, not a claim that an
8 km authored region is impossible.

## Remaining acceptance

Native source review on 15 October 2026 passed all five new district views at
frozen source `99ce59078`. Each prepared nine verified cells: Mesa 535,464 geometry
bytes; Gorge 584,928; Twin Buttes 535,560; Split Ravine 539,640; Sunset Shelf 538,176.
The broad mesa, winding gorge, two-hill crossing, fork and shelf routes were visibly
distinct. No warnings or errors were reported; Release reported no live scenery or
collision. Evidence: `canyon-districts-gorge-20261015.png` in the external fpv-temp
review directory. This accepts bounded source composition, not final realism,
kilometer-scale delivery or device-performance qualification. No new delivery or
Library pin is published here. Player admission, exact package/offline checks,
physical-device performance, broader art quality and eventual kilometer-scale
composition remain separate gates.
