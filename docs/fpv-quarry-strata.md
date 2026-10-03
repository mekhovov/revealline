# Amber quarry: authored rock strata

This bounded D2 candidate replaces the generic stone finish on the six existing
Quarry rock masses with fine retained rock grain, irregular faint mineral beds and sparse
short fractures. The normal and roughness response remains restrained. The
renderer reuses its existing world-aligned six-metre projection so the strata
share height across different rock masses. No position, vertex normal, index, box size,
collision, shadow caster, actor, route or objective changes.

## Exact scope and resource budget

Only authored `quarry` uses the new recipe. The complete six-solid layout must
be present with unique canonical IDs and exact dimensions:

| ID                   | Width × height × depth (m) |
| -------------------- | -------------------------- |
| `rock-west-terrace`  | 22 × 7 × 76                |
| `rock-east-terrace`  | 22 × 9 × 76                |
| `rock-west-rim`      | 8 × 16 × 82                |
| `rock-east-rim`      | 8 × 19 × 82                |
| `rock-central-spire` | 12 × 20 × 12               |
| `rock-landing-ledge` | 8 × 5 × 8                  |

Finite translated bounds are supported; typed and rotated solids are rejected.
Missing, renamed, resized or additional stone solids keep the entire old finish.
This course-wide guard avoids allocating both generic and new three-map sets in
a mixed creator layout. Existing metal conveyor classification stays unchanged.
Pixel and every shared collection bypass the new recipe. The new authored kind
correctly identifies its material role as concrete without changing existing
shared-theme stone metadata or appearance.

The pass replaces the already-owned albedo, normal and packed-property maps.
It adds zero textures, materials, meshes, triangles, instance batches or shadow
passes. Existing quality sizes and sampling limits remain unchanged. Runtime
source growth is 3907 bytes across world-visuals and renderer, below the agreed
4 KiB increment budget. Quarry has no built-in GLB: the actual procedural world
and its authored obstacle meshes are the target, not an imported substitute.

## Functional checkpoint

The [v4 manual CPU receipt](evidence/fpv-quarry-strata-cpu-v4.json) passes 444 checks
across 83 scene cases against main
`0aeb0c2b4342715ba9a19b976114d7d905fed7bd`. It executes source-extracted
`renderObstacle` and the real helpers to inspect actual box UVs, edge meshes and
conveyor panels. Only the approved rock maps, UVs, kind and concrete-role metadata
change. Floor, dressing, all physical geometry and all other environments remain
exact. It covers all five Quarry courses, all three presets, Pixel, all 17 shared
collections, creator fallbacks, deterministic quality cycling and once-only
resource disposal. No new unit coverage is introduced.

In this world-plus-obstacles scope both sides retain 36 geometries, 40 materials,
12 textures and five instance batches. Raw texture storage stays 0.75 / 3 / 12 MiB
for low / balanced / high, excluding mipmaps and other renderer groups. These
are ownership counts, not hardware frame-time measurements.

Frozen candidate module SHA-256 values:

- world-visuals: `ab8306298c6e2517a21106952b99098b9181b5cfbaf2d7359d92f72958a360c8`
- renderer: `28baf7f257c7beb8a8d166aae24d25335e7bf778b53a63d63aace281f50b5b43`

The frozen actual-renderer preview is
`dist/fpv-quarry-strata-verification-source-v4/index.html`: West terrace at
11 m, a preview-only close terrace pose at 3 m, and Central spire at about 26 m,
with FPV, chase and overview controls. The bounded matrix
covers the authored appearance plus exact Pixel/shared-theme images, a real
imported Courtyard control and a procedural Coast control. Source modules and
harness hashes are pinned. Bounded human visual review is accepted, and fresh retained-proof replay has
passed. Constrained actual-browser qualification now passes as described below;
package admission and actual packaged-player observation remain pending. No readiness,
finished-world, physical-device or public-deployment claim is made here.

## Rejected visual revision retained

V3 passed the [mechanical CPU checks](evidence/fpv-quarry-strata-cpu.json), but
human review rejected its smooth, regular beige/brown banding and lost rock
grain. The [rejected West terrace capture](evidence/fpv-quarry-strata-v3-rejected.png)
and frozen `dist/fpv-quarry-strata-verification-source-v3` remain preserved.
Its world-visuals SHA-256 was
`9fcc926c537457702ec70f5839ec760904ba1e9bb4f695e4b8daa1a3c01fe742`;
renderer bytes were identical to v4. No package or publication was attempted.

V4 restores the original stone grain and mottling amplitudes, keeps the base
stone colour, and adds faint unequal beds with noisy, fading seams and short
branched fractures. Mechanical qualification still passes 444 checks in 83
scene cases. Human review accepted v4 specifically as a bounded surface correction: grain is
retained at 11 m, broken seams improve the 3 m view, and the overview silhouette
and readability remain unchanged. The [close view](evidence/fpv-quarry-strata-v4-close.png)
and [overview](evidence/fpv-quarry-strata-v4-overview.png) preserve this observation.
This is not complete-world artistic acceptance.

## Browser control diagnostic and constrained source qualification

The [uncontrolled v4 browser run](evidence/fpv-quarry-strata-source-v4-failure.json)
retains 109 passing checks, one failure and all 56 image pairs. Its unrelated
actual imported Courtyard control differs by 176 pixels. A fresh
[v5 diagnostic run](evidence/fpv-quarry-strata-source-v5-diagnostic-failure.json)
without static previews differs by 27 pixels. Neither is presented as a pass.

All 77 material records, decoded texture pixels, 298 mesh geometry/matrix/visibility
records, GLB bytes, world geometry and resources are exact. The differing values
are 36 imported material-ID ranks and 32 opaque draw submissions: asynchronous
image completion changes the creation order of concrete, wall lines, windows and
doors. The production loader constructs each material after its texture promises
resolve. This is outside the Quarry recipe, but the original pixel equality
failure remains real and disclosed.

The source-v6 diagnostic constrains only Courtyard import construction to its
encoded GLTF material-index order on both sides. It preloads the same textures,
requests material dependencies in source order and immediately restores the
temporary loader hook. No production source, geometry, material properties,
render order, texture bytes or comparison tolerance changes. It must prove each
side preserves every scene input and then compare exact pixels. The [controlled diagnostic](evidence/fpv-quarry-strata-order-diagnostic.json)
passes five explicit checks: each side retains its full semantic scene, both
relative material ranks match, source order matches, temporary hooks restore,
and exact pixels match. This fresh diagnostic happened to have zero differences
in its uncontrolled pair too; it does not erase the earlier 176/27-pixel failures
or establish unconditional imported-scene determinism.

The final [source-v6 actual-browser receipt](evidence/fpv-quarry-strata-source-browser.json)
passes all 116 checks, 56 image pairs and three resource cycles. It retains the
full control diagnostics, checks every temporary-hook restoration, and uses zero
pixel tolerance for Pixel, shared Themes and the constrained imported control.
Quarry views use the unmodified runtime. Candidate module bytes still exactly
match accepted v4; only the fixture's unrelated imported-control construction
is constrained. Public and admitted-player observations use the normal loader.

## Current-main integration

Normal merge `3e681c45da13baa1e26c239f54673e081fb664dd` includes main's Lighthouse
`287eec95c81687fb8a6d176f750f7c65a60e1fe3`. Both documentation histories are
preserved. The independent [114-check integration summary](evidence/fpv-quarry-strata-main-integration.json)
proves that removing exactly the incoming Coast-only hook/helper leaves the
entire previous world-visuals AST exact. Eight direct helpers, every other one of
67 runtime/asset files, nine Quarry scene/map snapshots and three Courtyard
CPU controls remain exact. The summary explicitly records that its two raw
heredoc probes remain in task history, not as standalone files.

The integrated world-visuals SHA-256 is
`053f74a1d42db8373994350010f347ff0d306dfebd05cbdd9bf7df838b73d9e0`;
renderer SHA-256 and the Quarry recipe/guard are unchanged from accepted v4.
The source browser receipt still identifies its historical pre-integration
candidate. Incoming Lighthouse art intentionally changes Coast; final package
comparison must use current-main baseline there, not demand obsolete Coast art.

## Fresh authoritative flight replay

At normally integrated head `3e681c45da13baa1e26c239f54673e081fb664dd`, the
[manual replay receipt](evidence/fpv-quarry-strata-replay.json) passes 237 checks
for all ten authenticated retained recordings: both modes of all five Quarry
courses, 41,643 fixed steps, every objective complete and exact final identities.
All contacts remain zero; no actor is blocked at the final state. Ten Rapier
collision worlds are created and freed once each, with peak live count one and
none left live. One-second path samples are not continuous clearance proof;
free-call observation is not a memory-plateau or hardware measurement.

Quarry 04 historically finishes at 94/100 health in acro and 97/100 in self-level,
with 17 shots and seven hits in each. Those outcomes are preserved exactly.
An initial copied Coast probe incorrectly required full health; its
[failure log](evidence/fpv-quarry-strata-replay-v1-assumption-failure.txt) and
[probe](evidence/fpv-quarry-strata-replay-v1-probe.mjs) remain historical. The
[corrected executed probe](evidence/fpv-quarry-strata-replay-probe.mjs) checks exact
archival outcomes without changing the runtime, controls or proofs. The
[authenticated inputs](evidence/fpv-quarry-strata-replay-inputs.json.gz) preserve
all ten complete original recordings and manifest provenance. Decompressed input
SHA-256: `51f81dce4bb2322a803026428519a1208fdbdb30def7b418b66730a52d728fe2`.

Node 22 full `npm run validate` passed on the accepted v4 source before the
incoming Lighthouse-only merge. Runtime lint, formatting and diff checks pass.
No new unit coverage was introduced.

## Published work preserved

Lighthouse #1015 merged normally at
`287eec95c81687fb8a6d176f750f7c65a60e1fe3`, with its published branch and recovery
ref preserved alongside accepted source/package/player evidence. The [public marker](evidence/fpv-coast-lighthouse-public-marker.json) now matches
that merge; an actual public Lighthouse approach render/arm through 0.2 seconds/
pause-to-menu completed with empty warning/error logs, preserved in the
[live capture](evidence/fpv-coast-lighthouse-live.png). Quarry is independent and
does not alter that PR or its frozen outputs.

Root separately verified Courtyard #1012 and Warehouse #1014 at public marker
`0aeb0c2b4342715ba9a19b976114d7d905fed7bd`: Courtyard welcome and Loading bay both
rendered, armed through 0.2 seconds and paused, with empty warning/error logs.
The [marker receipt](evidence/fpv-courtyard-warehouse-public-marker.json),
[Courtyard capture](evidence/fpv-courtyard-live-0aeb0c2b4.png) and
[Warehouse capture](evidence/fpv-warehouse-live-0aeb0c2b4.png) preserve those
observations without changing Lighthouse's ready head.
