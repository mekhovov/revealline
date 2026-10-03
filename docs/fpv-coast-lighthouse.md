# Coastal airfield: lighthouse finish

This D2 increment makes the existing lighthouse recognizable from the harbour
approach. The 6 × 22 × 6 m collision box receives cream concrete paint, four red
bands, a closed upper lantern gallery and a closed service door. Its roof,
silhouette, route space and collision remain unchanged. This is a bounded
landmark finish, not a completed-world or hardware-performance claim.

## Scope and ownership

- Environment `coast`, obstacle `coast-tower-lighthouse`, dimensions exactly
  6000 × 22000 × 6000 mm; finite bounds and no type or rotation override.
  Translated copies retain paint on their own faces. Other dimensions, IDs,
  environments and typed/rotated creator solids keep their previous appearance.
- Four opaque batches, 54 quads / 108 triangles / 324 vertices, four world-owned
  materials. Every vertex lies on an original box face. Polygon-offset layers
  order shell, bands, panes and trim without moving a surface into flight space.
  No new shadow casters, geometry dependency or image asset.
- Authored paint reuses the existing concrete obstacle maps. Shared Themes reuse
  their already-owned concrete and steel maps; the bands use the selected theme
  accent. Pixel bypasses the finish entirely. Total renderer texture ownership
  does not grow: the baseline already initializes those maps for its obstacles.
- No catalogue, course, physics, recording, identity, renderer or imported scenery
  module changes. The runtime addition is 4041 bytes before current-main integration.

The catalogue calls this world **Coastal airfield**, but its identifier is `coast`
and its authored scene contains piers, a harbour bridge and a lighthouse. Coast
has five Adventure courses and one 120 × 120 × 35 m flight bounds. It has no
built-in GLB: its procedural world is the actual runtime scene. There are zero
installed Coast demonstrations; no new flight proof is claimed here.

## Qualification checkpoint

The first frozen source fixture compares main
`25700b699cc3c6e2b56d1917803dd7c4e6933b42` with lighthouse runtime SHA-256
`59ed9e77d54daec56d6a1f87f7677f7830c61787a0daad004095caf478fb6c1b`.
A subsequent missing-input guard adds one optional-chain character, with identical
geometry and materials. The initial frozen visual remains the guard predecessor.
It retains 31 modules per side, 19,733,616 source bytes total, under
`dist/fpv-coast-lighthouse-verification-source-v1`.

The bounded browser matrix uses one representative Coast bounds, all three
presets, Authored / Pixel / Industrial Workshop, FPV / chase / overview, and two
inspection poses. It additionally checks all five course IDs, an actual imported
Courtyard GLB control, a Quarry procedural control and repeated resource release.
Its 54 Coast image pairs are static observations, not recorded flights. Preview
controls expose the harbour approach and upper lantern gallery before acceptance.

The [manual CPU receipt](evidence/fpv-coast-lighthouse-cpu-source.json) passes
467 checks across 57 scene cases. It verifies all five courses, canonical and
creator guards, 13 other environments, unchanged pre-existing surfaces, four
added geometries/materials, zero added textures and exactly-once resource release.
Pixel adds nothing. The guarded runtime SHA-256 is
`082ea03268698c60c0038ab54276906761aa74477293f3450f099edb0b4eca7f`.
Ten historical Coast proofs / 41,868 ticks are authenticated against the retained
archive, not freshly replayed.

The runtime, qualifier and fixture pass focused lint/format, and the embedded
harness parses. Final human acceptance, actual-browser results and package qualification are
recorded below. Do not publish this
feature as qualified on the strength of fixture preparation alone. No new unit
coverage was introduced; manual functional qualification stays within D2.

## Current-main integration

The normal merge at `26f098361ac21ff471d3a280b7950065cd093ec1` incorporates
main `cd2e6bc5dc0e8af7d1d30705632697cc97562dc1`. Its adjacent helper conflict
was resolved by retaining both complete Lighthouse and Courtyard functions.
The [integration receipt](evidence/fpv-coast-lighthouse-main-integration.json)
proves both helpers retain their exact pre-merge bytes; removing the Coast-only
hook and helper leaves main's normalized runtime AST exact.

The [integrated CPU receipt](evidence/fpv-coast-lighthouse-cpu-main.json) again
passes all 467 checks / 57 scene cases against that main baseline, including
Courtyard preservation. Final runtime SHA-256:
`23663ba5c6027611d147fd6e01c3a7c11cbdf4575a61c2554424901c5c463715`.
Source growth is 4041 bytes, within the agreed 5 KiB increment budget.
The final frozen preview is
`dist/fpv-coast-lighthouse-verification-source-v2-main/index.html`, with 31 modules
per side / 19,747,475 bytes. The original v1 visual is retained as history.

Node 22 `npm run validate` passed on the guarded source before this inactive
Courtyard merge; the final runtime, manual qualifier and fixture pass focused
lint/format and embedded-script parsing. This was the pre-Warehouse integration checkpoint; the subsequently accepted
source preview, completed browser matrix and package admission are recorded below. Recovery ref
`codex/fpv-coast-lighthouse-source-checkpoint` preserves the pre-merge candidate;
published Warehouse and earlier frozen players remain untouched.

## Fresh retained-proof replay

The [new replay receipt](evidence/fpv-coast-lighthouse-replay.json) executes all ten
complete, authenticated Coast recordings against candidate
`1949ff56fa46727deb04b88ecc86a2e237e22f98`: both modes across all five courses,
41,868 ticks, 237 checks. This supersedes the initial authenticate-only checkpoint.
All original controls, normalized course identities, runtime/world/mode/response/
rules/conditions identities and final-state identities match. Every objective
completes with zero contacts and full health; no actor is blocked in the final
state. The original archive remains pinned by its previously published digest.

Transparent wrappers observe ten actual Rapier collision worlds created and
freed exactly once, with peak live count one and final count zero. The wrappers
forward unchanged calls and are restored in `finally`. Source bytes remain stable
through the replay. This is a functional replay/resource observation, not a process
memory plateau or hardware claim. Path samples are one-second snapshots, and
actor blockage is checked in the final state; no continuous swept-clearance claim
is made.

The [exact executed probe](evidence/fpv-coast-lighthouse-replay-probe.mjs) and
[compressed authenticated inputs](evidence/fpv-coast-lighthouse-replay-inputs.json.gz)
are retained for review. The probe preserves its historical checkout and temporary
archive paths rather than presenting itself as a portable automated test. The
receipt binds both probe and uncompressed input hashes. No installed demo, newly
generated recording or unit coverage is added.

## Warehouse integration and admitted package

Normal integration of main `0aeb0c2b4342715ba9a19b976114d7d905fed7bd` produced
clean package candidate `1949ff56fa46727deb04b88ecc86a2e237e22f98`, tree
`6ec046350e3b04236a188739d6a5da749c853306`. The incoming production change is
Warehouse-only imported placement composition; D1 evidence changes are documents.
The [23-check scope audit](evidence/fpv-coast-lighthouse-warehouse-integration.json)
proves Lighthouse visuals, renderer, courses, physics and demos remain exact;
Coast/Quarry still return no built-in GLB, and other imported worlds preserve both
Authored and Pixel GLB bytes. This leaves every frozen Lighthouse matrix case
unchanged without repeating it solely for unrelated incoming artwork.

[Source-bound admission](evidence/fpv-coast-lighthouse-admission.json) passes for
all three packages, each built twice with identical output, verified committed
inputs and verified ZIP members under unchanged guards:

| Package | Files | Uncompressed bytes |
| ------- | ----: | -----------------: |
| Flight  |    48 |            679,266 |
| FPV     |    69 |          4,391,024 |
| World   |   102 |         15,546,099 |

The 95 original World inputs total 16,752,261 bytes, leaving 24,955 bytes below
16 MiB. All 15 artifact checksums were reread. The complete admitted World ZIP was
extracted and all 102 members byte-verified, including the launcher and package
metadata; this is not the smaller development playtest staging. Its SHA-256 is
`1d798e7184a235ec67ee33395f6d62c16bb5bf475a40ffdf1b248f69fe72ea72`.
The [player inventory](evidence/fpv-coast-lighthouse-admitted-player.json) binds
`dist/fpv-coast-lighthouse-admitted-player-1949ff56f` to that exact ZIP.

The [source/package closure audit](evidence/fpv-coast-lighthouse-source-package-closure.json)
checks all 31 packaged comparison modules against the admitted player. The only
source-to-package differences are selected locale projection and the audited,
inactive Warehouse asset composition. The harness is identical. The packaged
fixture is `dist/fpv-coast-lighthouse-verification-package-1949ff56f`.

Human review accepts the actual source [harbour approach](evidence/fpv-coast-lighthouse-harbour.png)
and [upper lantern gallery](evidence/fpv-coast-lighthouse-lantern.png) as a bounded
visual improvement. Final [source](evidence/fpv-coast-lighthouse-source-browser.json) and
[package](evidence/fpv-coast-lighthouse-package-browser.json) actual-browser
receipts each pass **97 checks / 56 image pairs**. Every check and image-sample
record is JSON-identical between source and package. Pixel pixels remain exact;
Coast uses the actual procedural scene, Courtyard control explicitly loads its
actual imported GLB, and Quarry remains procedural. Existing geometry, three
stable resource cycles, final zero registered ownership, and no unexpected
context loss or application error pass. Raw pixel buffers are not retained;
complete per-view hashes/counts and all checks are preserved without truncation.

The [complete 102-file admitted player](evidence/fpv-coast-lighthouse-player.png)
loaded Lighthouse approach, rendered the scene, armed and advanced 0.2 seconds,
then Pause returned to the menu. Warning/error logs were empty. This player
uses the exact admitted ZIP inventory above, not development staging. No
hardware-performance, installed/offline-identity or public-availability claim is
made by package admission.

## Next Quarry boundary

The separate read-only Quarry audit found six canonical closed rock masses using
the generic stone surface, 60 exterior procedural terrace boxes and 28 floor-mark
instances. A useful next increment is authored-only amber strata and restrained
fractures on those six existing solids, preserving Pixel and shared Themes with
zero new geometry or maps. Quarry has no imported GLB and five Adventure courses.
That proposal is not implemented in this branch.

## Supplemental Warehouse publication checkpoint

This section records additional observations without resetting ready PR #1014.
Root verified the complete 102-file admitted Warehouse player from clean candidate
`860c23d0fe64f9db2f5822b05df34bbea45eb267`: Retry returned 0.0 s / zero throttle,
Arm and Continue advanced to Flight active 0.5 s, then Pause returned to the menu.
Browser warning/error logs were empty. Screenshot:
[integrated admitted player](evidence/fpv-warehouse-exterior-integrated-player.png). This is a local admitted ZIP
player observation, not installed/offline-identity or public deployment evidence.

After Courtyard merged, normal GitHub update-branch used exact expected head
`b5a7a3b5a04ce158d3cb6aa97124f2709dcfef0f`, producing
`45da28a5adb1e0713c0eeab4868801c72c4a84a4`. A scoped 11-check audit confirms
that the only incoming runtime addition is the Courtyard-only non-Pixel hook and
its pure helper; removing them leaves the prior world-visuals AST exact. Warehouse
module/template/provenance, renderer, course, themes, physics and demos are exact.
Recounting the existing 95-path original-input inventory yields 16,748,220 bytes,
28,996 below the unchanged 16 MiB guard. This is a recount, not new admission.
Receipt: [scoped integration](evidence/fpv-warehouse-exterior-courtyard-integration.json). Fresh protected CI owns
publication qualification; no status-only change was pushed to #1014.
