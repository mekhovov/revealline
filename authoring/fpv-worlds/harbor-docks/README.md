# Harbor Docks — original content candidate

An original fictional Ukrainian quay. The supported portal gantry, closed container groups, raised service deck and waterside boundary form three readable flying spaces. The r2 scene has bounded actual-renderer acceptance. The frozen eight-course r3 exposed an actual finite-support movement defect; r4 explicitly opts its two civilian ground subjects into the separately versioned correction. All sixteen fresh r4 ordinary flights and independent complete/archive replays now pass. Complete browser/import/native/offline qualification remains pending. This is not a completed or published eight-course world yet.

The revised r2 scene has 7,900 triangles, ten imported material batches, two original 256px maps and 38 solid records. Source GLB 761,036B; prepared GLB 760,368B and zero glTF validator errors. The one-course pack/ZIP round trip and 148 static collider-marker, support, expanded waypoint, swept-route and serialized-water checks pass. A separate 23-check r1/r2 comparison preserves every course field except revision, all markers/colliders and both embedded PNG byte streams. Six actual r2 views and disposal are retained in `evidence/r2-static/`; continuous water, recognizable barge, service deck and Low/Pixel readability were accepted for course expansion. This establishes a bounded stylized scene, not commercial-realism or hardware acceptance.

The r1 actual renderer review retained eight views, no errors and disposed all registered resources. Closed containers and the supported gantry were accepted as foundations; the full scene needed a coherent water background, a shaped barge and less blank service-deck paint. The Pixel container capture was retained but not personally visually accepted. That historical review and screenshots remain in `evidence/r1-static/`; its 6,088-triangle assets and 142-check survey are unchanged.

r2 extends water beyond the review frusta and around the quay ends, shapes the original barge bow/stern with cabin glazing and deck rails, and partitions the existing closed service facade/roof/deck into opaque paint regions. It adds 1,812 triangles, no imported material or image owner, and no collision or route change. Before/after camera positions remain matched; new vessel and deck-roof views are static inspection aids outside gameplay, not additional playable space.

All playable land rests on a real platform at Y0–2m. Spawn is Y2.25m; the first landing names `platform-quay`. Water is visual at Y0.22m starting X43m, outside the playable maximum X40m; north/south background water also stays beyond the quay ends and playable Z bounds. Each serialized water triangle is checked against that contract. The visible east boundary is continuous. No over-water physics or route is implied. Cosmetic attached lock bars/straps are not presented as flyable gaps.

The existing required `REVEALLINE_surface_coating` version1 opaque-finish capability provides fixed host-defined depth bias for exact canonical painted planes. Imported face regions are partitioned; no free numerical rendering state or new runtime code is introduced. Old unsupported hosts must refuse this capability. Low/Balanced/High, Pixel/shared appearance, grazing paint and shadow boundaries need actual visual review.

Original CC0 geometry/maps/lettering; see [design and reference](DESIGN.md) and [license](source/LICENSE.md). Encoding helpers adapt the project's own authoring utilities. No copied competitor assets or logos, new renderer style, package ceiling changes or new unit coverage. The content does not edit shared physics code; its explicit versioned movement dependency is described below.

```sh
node authoring/fpv-worlds/harbor-docks/build-checkpoint.mjs NEW_DIRECTORY
node authoring/fpv-worlds/harbor-docks/qualify-scene.mjs EXACT_PACK NEW_RECEIPT.json
node authoring/fpv-worlds/harbor-docks/qualify-refinement.mjs R1_DIRECTORY R2_DIRECTORY NEW_RECEIPT.json
node authoring/fpv-worlds/harbor-docks/prepare-preview.mjs EXACT_ADMITTED_102_PLAYER GENERATED_DIRECTORY NEW_PREVIEW_DIRECTORY
```

The static preview authenticates every complete admitted player byte and uses that renderer unchanged. Named views show the arrival apron, closed containers, gantry, service deck, water boundary, grazing apron and wide/overview/chase composition. These are manual observations, not flights or performance measurements. Freeze the final shared scene before all eight routes and sixteen fresh exact-pack proofs.

## Eight courses, with the failed r3 checkpoint retained

The exact accepted r2 source/prepared GLB bytes are reused by hardlink. All eight layouts share the same 38 solids and bounds. The source has EN/UK briefing and lesson text, independently cloned Self-level/Acro criteria, source-bound orientation anchors and local route ownership for the other layouts:

1. Quay check-in — orientation and return to the real raised quay.
2. Container perimeter — ordered race around the closed stacks.
3. Gantry height line — climbing race through the real opening and down the waterside lane.
4. Service-deck landing — precision landing on the named 5.5m support.
5. Terminal cart escort — civilian cart at quay Y2m; real six-second tracking and at least four metres of target travel.
6. Deck inspection — civilian walker on the 5.5m deck; real four-second range/nose/relative-speed/visibility criteria.
7. Training-drone bay — isolated fictional stationary nonfiring target, using ordinary simulated projectiles and target health; no civilian in this layout.
8. Harbor circuit — distinct capstone ending on the service deck.

The first 406-check static survey retained three failures in `evidence/r3-static-v1-failed.json`: a copied half-space-floor predicate disallowed negative contact offsets. A second survey measured a transient 14mm walker deviation during a coarse 500mm move. Finer nominal spacing exposed stalled horizontal motion; it did not qualify the content. All three failures remain under `evidence/`.

Actual `createWorldFlight` diagnostics then confirmed the runtime issue using 3,000 ordinary neutral-input ticks: the cart stops after about 2.97m and the walker after about 0.42m, while support queries still return the correct quay/deck. A diagnostic-only prospective 10mm initial clearance did not fix it and was never applied to source. Nine minimal cases retain the full synthetic course data and runtime hashes in `evidence/r3-minimal-ground-cases.json`: canonical half-space controls travel normally, whereas the exact and narrower finite cuboids and equivalent closed-trimesh supports stall. Wall/ledge cases are retained for a future correction, but the old behavior stalls before those boundaries and therefore does not establish their corrected behavior.

The accepted scene, all 38 collider definitions, r3 routes/actors and pack identity remain frozen at `590fbb10011c596e179c1c3b82d278d39a42d2e0`. The original r3 observer's 12mm maximum and all failed receipts remain historical. No complete proof was generated for r3.

## Explicit r4 ground-motion dependency

The r4 branch starts from runtime prerequisite `9b5c3d65e2877847126c87f263fbc7e9aca357fb`. Only the cart in course 05 and the inspector in course 06 receive `groundMotion: "support-v1"`; the stationary training drone remains unmarked. The project, pack and all eight course revisions advance to r4. Scene/model bytes, all collision solids, bounds, spawns, actor paths/speeds, route criteria, objective tolerances and source bindings stay fixed. Older runtimes reject the unsupported actor field; this content must not be listed for an older Library runtime cohort.

The opt-in algorithm retains the existing 10mm controller margin and uses a 1mm downward request plus 1mm integer clearance. Its normal clearance is 12mm; the Harbor r4 observer explicitly permits two additional 1mm native/support rounding steps, giving a 14mm maximum on these flat named supports. It records both signed `actor.feetY - authoredSolid.max.y` and the separate native support-ray gap on every civilian tick, rejects negative or greater-than-14mm values and requires the exact named support. No actor pose is assigned by the qualifier. This r4-only policy does not retroactively change the r3 failures. A center-ray gap on a stepped general-purpose case is not used to justify changing these flat Harbor supports.

At source `1e599c2687c3e2578afcf58c207995b05e0a1ed0`, the exact revision comparison passes 25 checks and the static survey passes 407 checks. The full qualifier passes 540 checks: sixteen ordinary-control completions, sixteen independent complete replays and sixteen independent replays after archive import. The emitted archive contains sixteen unique course/mode pairs and 51,615 frames, each containing only the five integer input values. Final identities match the complete-flight receipts; no state/tick/completion assignment is used. Imported `verified` labels are not trusted: archive reimport first requires the exact dependency and then replays it.

Across all 6,700 civilian flight ticks, both subjects retain the correct named support without a failed observation. Their independent feet-to-solid gaps are 12–13mm; the cart's native-ray gaps are 12–13mm and the inspector's are 11–12mm. In each mode, Follow completes 300 continuous ticks with 4.2m target travel; Observe completes 200 ticks with 1.2m travel. The isolated fictional training drone follows actual health transitions 50→25→0, with two hits and a real defeat event in each mode (five Self-level shots and four Acro shots). No civilian shares that layout.

The complete immutable receipts and byte inventory are in `evidence/r4-cpu-checkpoint.json` and `evidence/r4-qualification.json`. The data-only files are [pack](distribution/r4/harbor-docks.r4.rlpack), [editable ZIP](distribution/r4/harbor-docks.r4.zip) and [sixteen-record proof archive](distribution/r4/harbor-docks.r4.proofs.json). Pack SHA256 is `d5bf4b9bb6829c04dbe1bb398893e5243cefc1f9acf018bf153a2012c8cf49b6`; archive SHA256 is `7341d203aa2d3a61199a0000cc87a31f50553588dad610d878a5238aab433102`. Exact capable-player import/Watch, visible native subjects and stopped-origin offline review remain later gates; the prior r2 scene acceptance does not imply that the eight courses have passed them.

```sh
node authoring/fpv-worlds/harbor-docks/build-world.mjs ACCEPTED_R2_DIRECTORY NEW_WORLD_DIRECTORY
node authoring/fpv-worlds/harbor-docks/qualify-world.mjs EXACT_PACK NEW_RECEIPT_DIRECTORY --clearance-only
node authoring/fpv-worlds/harbor-docks/qualify-world.mjs EXACT_PACK NEW_PROOF_DIRECTORY
node authoring/fpv-worlds/harbor-docks/prepare-world-import.mjs ADMITTED_RECEIPT WORLD_DIRECTORY PROOF_DIRECTORY NEW_FIXTURE
node authoring/fpv-worlds/harbor-docks/diagnose-ground-actors.mjs EXACT_PROJECT RUNTIME_ROOT NEW_RECEIPT
```
