# Warehouse exterior composition

This D2 increment turns the isolated exterior window panels into connected bays
and gives the two industrial backlines different depths. Pilots see these
frontages through the existing perimeter glazing and above the interior beams.
The warehouse shell, racks, floor, glass and collision volumes remain unchanged.

## Bounded scope

Only the `warehouse` scenery composition changes, across 29 current courses and
four bounds: 19 Snake challenges, eight Warehouse challenges and two school
lessons. All 57 licensed placements remain in their original order. Six buildings
and 32 window panels translate; their geometry, scales, rotations, textures,
materials and shadow flags remain unchanged. Two containers, two trucks, ten
pallets, four lights and the tank retain exact placement. No new asset, material,
texture, collision, decoder, network request or shadow caster is introduced.

Each side has two four-panel runs at a 6.04 m pitch. The existing panels are six
metres wide, leaving a four-centimetre construction joint. Their height, lower
edge at 2.5 m and half-metre flight-envelope setback remain unchanged. Asymmetric
run centres retain at least 3.30 m corner margins and 4.04 m between runs even at
the 64 m minimum supported span. Smaller creator arenas retain the entire prior
layout. Six backline buildings keep their heights and move into staggered
positions/setbacks; the nearest northern building also clears the existing tank.

The Pixel palette and nearest filters remain unchanged. Shared Themes continue
through their existing imported-material binding path. Imported placement changes
apply to all appearances; an unchanged Pixel image is not claimed for this
composition increment. Resource ownership and disposal stay with the existing
world renderer. The GLB still reports 57 source meshes, six batches, 42 instances,
15 unbatched meshes and four spatial groups.

## Functional qualification

The manual qualifier compares current output with main
`e40809f25ea8fe248dea6f8443876d811d21a777`. It passes 416 checks across all 29
Warehouse courses/four bounds, 16 unaffected scenery cases covering the five
other supported environments and eight translated creator cases at and around
the 64 m cutoff. Only the intended 38 translations differ in actual GLB node and
instance buffers. The library, mesh/material data, all other transforms and
original asset files remain exact. No positive AABB overlap involves a moved
model. All 18 installed Warehouse World recordings replay exactly through
44,168 ticks. Other recordings retain exact input bytes and are not claimed as
freshly replayed.

Two offline generations produce identical runtime and provenance bytes under
Node 22.22.2, using the existing pinned authoring dependencies. The embedded
Kenney CC0 library remains 861,504 bytes, SHA-256
`6153c9c7e5dbe571e91a1ba54d021a95bf618db13873e7e661f1ea593c71573e`.
The current runtime is 1,167,023 bytes, SHA-256
`1191d5ce7df7ae6a80a30bcf49094baa1ad8e2ad5148aabadc915caf36f949da`.
No source-budget or package guard changes. Full `npm run validate`, scoped
lint/format, browser-module syntax and all nine existing acceptance-workflow
checks pass under Node 22.22.2. No new unit coverage is added before D6.

The frozen browser fixture explicitly calls the actual renderer's `loadScene`
with each side's GLB before preparation and drawing. It checks four bounds,
low/balanced/high, authored/Pixel/Industrial Workshop, FPV/chase/overview, views
through glazing and above beams, actual imported vertex clearance, exact
interior geometry, unchanged imported resource counts/filtering, five unaffected
scenery controls and repeated disposal. It retains full source inventories and
all per-view hashes/counts. Static observations do not certify flight completion,
physical-device performance or final artist acceptance.

The frozen source fixture is
`dist/fpv-warehouse-exterior-verification-source-v4`, with 31 modules per side
and 19,723,725 bytes. Its complete inventories bind the runtime hash above.
The second harness adds preview-only camera selection and an exterior pose;
the 216 Warehouse plus five control comparisons retain the original two poses.
The overview and both interior poses have passed bounded art review: connected
four-panel runs, narrow joints and staggered backline depth are visible. The
preview-only exterior FPV pose intersects a baseline building and produces a
black before image; that pose is excluded from art evidence and from the full
matrix. The overview remains useful and is retained in the evidence image.

The first browser attempt failed a fixture count assertion. Its complete v2
failure and v3 diagnostic receipts are retained. The diagnostic shows exact
before/after resource snapshots: 36 meshes, 42,002 vertices, 106 primitive
instances, six materials, 17 geometries and six textures with matching filters.
The incorrect fixture expected 42 rendered instances; 42 is the logical GLB
instance count. Each of 32 window instances has three mesh primitives, producing
96 rendered instances, plus ten pallet instances. The corrected fixture keeps
resource equality as a separate check and derives the expected mesh/primitive
instance tally from the actual loaded GLB. No runtime or geometry change was
needed; the unchanged logical 57 placements / 42 instances remain required.

## Frozen package

Clean source `fcd075a55cdc7db4ae1c527bb7c465c87c41fd7e`, tree
`961d488c1eb3619f692576f1605d7a91684fe8f4`, passes all three source-bound optional
package admissions, two identical builds, committed-input and ZIP-member checks:

| Package         | Files |      Bytes |
| --------------- | ----: | ---------: |
| Civilian Flight |    48 |    679,266 |
| Civilian FPV    |    69 |  4,377,750 |
| World Studio    |   102 | 15,531,578 |

All 15 artifact checksums were independently reread. The 95 original World inputs
total 16,737,740 bytes, leaving 39,476 bytes under the unchanged 16 MiB guard.
The separate development playtest has 94 files / 15,373,807 bytes, ZIP SHA-256
`2215ae22ac2f1a1a6df4ee72b180061cd8aefb3a1b1a1e43f88f896a24cda2f5`.
All 31 packaged rendering modules match the admitted ZIP, player and fixture.
Only the intended generated locale catalogue differs from source. The corrected
source/package harness bytes are identical and add no production code.

The final actual source and packaged WebGL runs each pass 437 checks / 221 image
pairs. Their complete check arrays and sample arrays match exactly. Source receipt
SHA-256: `48ccd758a921b9269c6477527966ba953541686184d4e327bc801e97341a112b`;
package: `d3b951b3986c23d58b7985b06fc87f827da4a024bbb28afffaddc5044d472372`.
These complete receipts remain bound to frozen runtime `1191d5…` and candidate
`fcd075a55`; later main integration is qualified separately below.

The 94-file development playtest is not the complete admitted distribution. A
full ZIP comparison finds 91 common files exact, eight launcher files only in
the 102-file distribution, and three different install/cache/source metadata
files: `optional-package.json`, `app.webmanifest` and `worker.js`. This difference
does not affect the 31 rendering modules used by the packaged browser fixture.

For actual-player acceptance, all 102 original distribution ZIP entries were
separately extracted, bounded and independently reread without modification:
15,531,578 bytes, distribution ZIP SHA-256
`82f5edb5a3fb78317485b40351a901ffbc90d6a0cd0f6239f9caf0f38e575f99`.
That admitted player opened Loading bay, rendered the reviewed composition,
armed to 0.3 seconds and paused, with no captured warning or error. The retained
screenshot and complete byte inventory identify this actual 102-file player.
Installation/offline identity is not claimed by this local launch.

## Current-main integration

Main `25700b699cc3c6e2b56d1917803dd7c4e6933b42` was merged normally at
`20c5235cda960da57f6a84d0801b4e52c28ee0ba`. Incoming Meadow surfaces and Woodland
material response remain preserved. The generator reproduces the merged runtime
exactly; its provenance metadata is refreshed to 1,168,270 bytes, SHA-256
`e1b987e2580b8b1e2d1afdfa3e9f0bc2d36a37e0bf516681cb0e94f045afd34c`.
The original embedded library remains exact. The manual qualifier is rebound to
this current main and again passes all 416 checks / 18 recordings / 44,168 ticks.
It preserves the original pre-integration receipt separately.

The separate scoped integration audit passes 225 checks. All 58 Warehouse
authored/Pixel GLBs across 29 courses are byte-identical to the accepted frozen
candidate. Twelve full scene snapshots across four bounds and authored, Pixel
and Industrial Workshop retain geometry, UVs, transforms, materials, texture
pixels and exactly-once resource ownership. The 3,812-byte Warehouse composition
block is exact in both template and generated module; renderer, replay, collision,
catalogue and recording inputs are unchanged. No full matrix is repeated solely
for these inactive incoming branches.

Integrated clean candidate `860c23d0fe64f9db2f5822b05df34bbea45eb267`, tree
`639b65e139249e1d38b6432437656e97cc454151`, passes fresh all-three admission,
committed-input verification, ZIP-member checks and two identical builds. Admitted
counts are Flight 48 / 679,266 bytes, FPV 69 / 4,380,054 and World Studio
102 / 15,535,129. All 15 checksums were independently reread. The 95 original
World inputs total 16,741,291 bytes, leaving 35,925 bytes under the unchanged guard.

Compared with the accepted historical admitted ZIP, 98 of 102 files are exact.
Only the two scoped incoming runtime modules and their package/worker identity
metadata differ. All 102 integrated distribution entries are staged and reread
without modification; ZIP SHA-256:
`a161e3b0f40c00b3689f4a664e4960d1adf9d9266adcf9a8d7ed45fa7d235e4e`.
The actual-player observation remains explicitly bound to the historical `fcd075`
admitted player; the integration proof establishes preserved Warehouse behavior. Local `publicEligible` and `releaseQualified` remain false;
protected publication, public deployment and physical-device qualification remain
separate.
