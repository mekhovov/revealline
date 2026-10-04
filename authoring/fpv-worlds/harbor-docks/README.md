# Harbor Docks — original content candidate

An original fictional Ukrainian quay. The supported portal gantry, closed container groups, raised service deck and waterside boundary form three readable flying spaces. The r2 scene has bounded actual-renderer acceptance; eight r3 courses are authored, but qualification is blocked by an actual runtime defect in moving ground actors on finite raised supports. Complete browser/import and native/offline qualification are also pending. This is not a completed or published eight-course world yet.

The revised r2 scene has 7,900 triangles, ten imported material batches, two original 256px maps and 38 solid records. Source GLB 761,036B; prepared GLB 760,368B and zero glTF validator errors. The one-course pack/ZIP round trip and 148 static collider-marker, support, expanded waypoint, swept-route and serialized-water checks pass. A separate 23-check r1/r2 comparison preserves every course field except revision, all markers/colliders and both embedded PNG byte streams. Six actual r2 views and disposal are retained in `evidence/r2-static/`; continuous water, recognizable barge, service deck and Low/Pixel readability were accepted for course expansion. This establishes a bounded stylized scene, not commercial-realism or hardware acceptance.

The r1 actual renderer review retained eight views, no errors and disposed all registered resources. Closed containers and the supported gantry were accepted as foundations; the full scene needed a coherent water background, a shaped barge and less blank service-deck paint. The Pixel container capture was retained but not personally visually accepted. That historical review and screenshots remain in `evidence/r1-static/`; its 6,088-triangle assets and 142-check survey are unchanged.

r2 extends water beyond the review frusta and around the quay ends, shapes the original barge bow/stern with cabin glazing and deck rails, and partitions the existing closed service facade/roof/deck into opaque paint regions. It adds 1,812 triangles, no imported material or image owner, and no collision or route change. Before/after camera positions remain matched; new vessel and deck-roof views are static inspection aids outside gameplay, not additional playable space.

All playable land rests on a real platform at Y0–2m. Spawn is Y2.25m; the first landing names `platform-quay`. Water is visual at Y0.22m starting X43m, outside the playable maximum X40m; north/south background water also stays beyond the quay ends and playable Z bounds. Each serialized water triangle is checked against that contract. The visible east boundary is continuous. No over-water physics or route is implied. Cosmetic attached lock bars/straps are not presented as flyable gaps.

The existing required `REVEALLINE_surface_coating` version1 opaque-finish capability provides fixed host-defined depth bias for exact canonical painted planes. Imported face regions are partitioned; no free numerical rendering state or new runtime code is introduced. Old unsupported hosts must refuse this capability. Low/Balanced/High, Pixel/shared appearance, grazing paint and shadow boundaries need actual visual review.

Original CC0 geometry/maps/lettering; see [design and reference](DESIGN.md) and [license](source/LICENSE.md). Encoding helpers adapt the project's own authoring utilities. No copied competitor assets or logos, new renderer style, physics changes, package ceiling changes or new unit coverage.

```sh
node authoring/fpv-worlds/harbor-docks/build-checkpoint.mjs NEW_DIRECTORY
node authoring/fpv-worlds/harbor-docks/qualify-scene.mjs EXACT_PACK NEW_RECEIPT.json
node authoring/fpv-worlds/harbor-docks/qualify-refinement.mjs R1_DIRECTORY R2_DIRECTORY NEW_RECEIPT.json
node authoring/fpv-worlds/harbor-docks/prepare-preview.mjs EXACT_ADMITTED_102_PLAYER GENERATED_DIRECTORY NEW_PREVIEW_DIRECTORY
```

The static preview authenticates every complete admitted player byte and uses that renderer unchanged. Named views show the arrival apron, closed containers, gantry, service deck, water boundary, grazing apron and wide/overview/chase composition. These are manual observations, not flights or performance measurements. Freeze the final shared scene before all eight routes and sixteen fresh exact-pack proofs.

## Eight-course r3 qualification in progress

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

The accepted scene, all 38 collider definitions, r3 routes/actors and pack identity remain frozen. No endpoint, pose, collision or physics shortcut is applied. A separately versioned opt-in runtime correction is being reviewed independently; Harbor will need an explicit new content revision and all sixteen fresh proofs once that contract qualifies. The proof observer requires real named support on every civilian tick, at most 12mm actual height deviation, full tracking criteria, actual projectile damage/defeat, complete ordinary flights and independent exact replays. No complete proof has yet been generated for r3.

```sh
node authoring/fpv-worlds/harbor-docks/build-world.mjs ACCEPTED_R2_DIRECTORY NEW_WORLD_DIRECTORY
node authoring/fpv-worlds/harbor-docks/qualify-world.mjs EXACT_PACK NEW_RECEIPT_DIRECTORY --clearance-only
node authoring/fpv-worlds/harbor-docks/qualify-world.mjs EXACT_PACK NEW_PROOF_DIRECTORY
node authoring/fpv-worlds/harbor-docks/prepare-world-import.mjs ADMITTED_RECEIPT WORLD_DIRECTORY PROOF_DIRECTORY NEW_FIXTURE
node authoring/fpv-worlds/harbor-docks/diagnose-ground-actors.mjs EXACT_PROJECT RUNTIME_ROOT NEW_RECEIPT
```
