# Mountain Reservoir — D5 readiness, 4 October 2026

Status: this document is the read-only readiness audit, not Reservoir content delivery. The audit used capacity integration `0241a523d`, which integrates main `5931ef12678cc52ab332fbbfe5516ad93a60caa9`. The separate [imported-example prerequisite](fpv-imported-world-examples.md) now has 46 functional checks, 47 checks each in source and admitted-package browsers, and all-three package admission; protected publication remains pending. Its branch normally integrates merged capacity main `ef9d606b6`. Separate original-scene drafting is underway, but no Reservoir course, sixteen-example set or full-world qualification is claimed here.

## Decision

The existing external-world pipeline can deliver one installable Mountain Reservoir pack with eight authored courses, a self-contained original scenery GLB and sixteen optional mode-specific proof records. Keep all content outside the admitted player source closure. The first necessary runtime prerequisite is exact-pack demonstration lookup: the audited baseline could not offer installed custom worlds Watch example even after their proof imports replayed successfully. The focused fix is being qualified independently while D4 route modes complete.

The external pack itself adds zero admitted source files or bytes if it stays under authoring/download paths and is not appended to world-assets, world-catalogue or world-demonstrations. It does not automatically become a default-installed world. The existing catalogue groups installed courses by course.world.id and updates displayed world/flight counts dynamically. An installation adds one world/eight courses locally; the default catalogue remains unchanged. D5's eventual 18-world/228-course claim requires a clearly stated distribution/install policy for all four content packs.

At audit time, capacity integration had 95 original inputs, 16,759,664 bytes and 17,552 bytes spare under the unchanged 16-MiB guard. The reviewed coaching growth of 6,281 bytes projected 11,271 bytes spare before D4 modes and the lookup change. The current lookup+capacity branch measures 16,760,138 bytes/17,078 bytes spare; coaching and route modes are still separate qualifications. Measure their exact integrated inventory before publication; do not raise the guard or inline reservoir assets.

## First support increment: exact external demonstration lookup

Files: `optional-practice/civilian-fpv/world-app.mjs`, a focused manual browser qualifier/receipt, and a qualification note. No renderer/physics/vendor changes.

At the audited baseline, `demonstrationFor` (about lines 915–960) always checked the bundled registry, then searched imported verified records only when `!entry.projectId`. Installed pack entries have projectId (refreshStorage, about 2530). Library proof import already matches exact packIdentity/course, compares normalized demonstration course data, independently replays and records the resulting state (restoreProofs, about 4720–4800). Library exposes Export, Pin, Remove and Verify again, not a separate playback button. startFlight also requires demonstrationFor to recognize a completed demonstration before playback.

Small contract:

- Bundled demonstrations remain for built-in entries; do not let an imported copy borrow a built-in proof by reusing its course ID/source bytes.
- For installed custom entries, select only an existing record with exact `fpv-pack:<64-hex SHA>`, course ID, full normalized course fingerprint (including revision), requested mode, demonstration session, verified status and complete diagnostic.
- Retain model/backend and responseIdentity checks. The recorded controls profile must match its declared identity; Watch uses the proven response profile, not a rewritten proof/current user preset.
- Retain independent complete-flight replay immediately before playback. Lookup is only a shortlist and must not initialize a physics world while rendering catalogue cards.
- Keep missing dependency/invalid/unverified records and their raw proof bytes; no automatic re-verification or trust of an imported status flag.
- Preserve no rewards/notebook completion for demonstrations, current return flow and replay pause guards.
- Refresh the weak lookup cache after import/install/removal/revision activation. Prove the wrong SHA/revision/mode/response cannot enable Watch, even with identical IDs.
- Native browser qualification: two modes, exact external pack, same-ID/different-SHA control, missing/reinstalled retained revision, invalid/tampered proof, reload persistence, real playback completion and unchanged reward state. Existing built-in examples remain available.

Simply deleting `!entry.projectId` is insufficient because the bundled lookup also needs correct scope. No new unit coverage is proposed here; D6 retains that task. The source delta must be measured, not assumed to fit.

## Reservoir authoring contract

Suggested stable IDs: project/world `mountain-reservoir`; course IDs `mountain-reservoir-01` through `-08`; first explicit geometry/content revision `r1`.

One shared scene, collision layout and route definition source should generate all eight FlightCourse.v2 courses. Every course needs English/Ukrainian title, brief and lesson; distinct objectives; both self-level and acro steps. Reuse existing gate, hold and land criteria. The marker-to-single-course convenience importer is not an eight-route authoring system: compile eight explicit course definitions through the existing project/courses pipeline. Axis-aligned X/Z gate semantics remain; use supported checkpoints/hold volumes for oblique approaches rather than inventing oriented gate physics.

A concrete eight-course design:

1. Shoreline check-in — establish height, visit two shoreline holds and return to the shore pad.
2. Dam crest — a precision gate line along the crest with clear lateral escape space.
3. Intake approach — wide slalom around fixed intake structures, ending at a maintenance pad.
4. Spillway descent — staged height changes through gate/hold targets, with a safe final approach.
5. Service passage — alignment through a genuinely open authored structure with collision-matched walls and clearance.
6. Terrace climb — alternating ascent/turns between accessible rock ledges.
7. Island circuit — broad linked turns around the reservoir landmark; no unmodelled water landing requirement.
8. Maintenance landing — approach, braking and stable landing on a clearly supported platform.

These are proposed route identities, not eight accepted challenges. Review a shared scene plus course 01 and two ordinary-control completion proofs as the first visual/collision checkpoint; then finish the other seven and all sixteen proofs before calling the world delivered. Do not label a one-course scaffold a completed D5 world.

### Geometry and presentation

The current physics volume uses integer millimetres within ±100 m on each axis (`world-model.mjs:76`), at most 256 obstacles and 20,000 aggregate collision triangles. Use a bounded reservoir flight area rather than a kilometre-scale landscape. Distant visual mountains may form scenery beyond the flyable volume but must not imply accessible unsupported routes.

Rapier consumes course.obstacles only. It supports oriented boxes and explicit trimeshes; glTF display meshes never acquire collision automatically. Blender collider markers are size+matrix boxes, converted by colliderFromAnchor. Irregular terrain needs explicitly authored collision triangles in the course source, not an assumed mesh-to-physics import. Semantic markers cannot be animated through themselves or their ancestors.

The renderer always draws canonical obstacle geometry and its ground plane; imported GLB scenery is additive. It hides exported collider helper nodes, but does not hide the rendered course obstacles. The fpvScenery fallback special case only covers three existing built-in environments and must not be spoofed. Avoid coincident imported and generated surfaces, visual openings backed by solid collision, or decorative objects in flight lines with no collision. Check all three quality levels; low quality does not decimate an arbitrary imported scene.

Use an existing outdoor presentation family and authored profile; do not add a mountain-reservoir renderer branch or inline world style. An existing Quarry environment can supply mineral obstacle materials/peripheral terrain while world.id remains mountain-reservoir; canonical Quarry finish guards will not qualify arbitrary new geometry. Field offers a grassy base but does not automatically classify new rock IDs as stone. A new environment string validates as data but currently falls back to generic concrete/metal, so it is not an automatic mountain presentation solution. Choose the presentation after one actual imported close/flight-distance preview.

Water can be authored scenery. There is no audited buoyancy/swimming/drowning contract; the world floor is a half-space at bounds.min.y. The scene and briefs must not imply physical water behavior absent from the course. Resolve any apparent walk/land-on-water mismatch during the first preview rather than hiding it in a new style flag.

The host labels imported entries as custom, exploration/intermediate/about four minutes by default, and the project-level world title is a single string. Course text is bilingual. Per-course catalogue metadata and a localized world title would be separate enhancements, not requirements silently solved by pack themes.

### Assets and licenses

Prefer original, purpose-authored terrain, dam, water surface and local props with a reproducible source script or editable Blender source. Keep original linked textures and sources separate from prepared outputs. Record author, explicit license, exact source hashes and transformations. The tiny CC0 authoring fixture license does not automatically apply to new artwork.

Optional already-retained prop reuse: selected Kenney City Kit Industrial 2.0 GLBs (for example detail-tank or water-tower) have local License.txt and byte-pinned provenance under `authoring/fpv-worlds/assets/kenney/city-industrial/`. Preserve those notices and original bytes and record derivative transforms. This audits the checked-in license/provenance only, not a fresh third-party download or legal conclusion. Do not regenerate the inline world-assets.mjs library for Reservoir. No new external asset search, download or license assertion is needed for the first original-scene checkpoint.

Pinned preparation is `scripts/fpv-content.mjs prepare`: glTF Transform 4.5.1, Khronos Validator 2.0.0-dev.3.10, Meshoptimizer 1.3.0 and Draco 1.5.7; pinned Blender 4.5.14 LTS export is available. It validates and deduplicates/prunes while preserving semantic transforms; it does not invent collision, texture sizes or license rights. Keep textures embedded PNG/JPEG. Do not introduce KTX2 or new decoder dependencies.

Working bounds: self-contained playable model plus dependencies ≤16 MiB; pack ≤64 MiB, ≤128 files; JSON ≤4 MiB; nodes ≤2048, meshes ≤512, images ≤64, materials ≤256, textures ≤128 and lights ≤8; images ≤4096 per dimension and 32 million source pixels. The renderer additionally bounds the sum of accessor counts to two million. These ceilings are rejection limits, not performance targets. Choose much smaller initial geometry/texture counts and measure actual preparation/resources.

## Proposed files and delivery

All new content remains outside the 95-input player closure:

- `authoring/fpv-worlds/mountain-reservoir/source/`: original source script or .blend, linked assets, export configuration, license/provenance.
- `authoring/fpv-worlds/mountain-reservoir/project.json`: eight explicit courses/definitions, source anchors/colliders, stable IDs, optional playlist.
- `authoring/fpv-worlds/mountain-reservoir/models/mountain-reservoir.glb`: self-contained prepared scene.
- `authoring/fpv-worlds/mountain-reservoir/report.json`: pinned preparation and transform/hash inventory.
- `authoring/fpv-worlds/mountain-reservoir/mountain-reservoir-r1.rlpack` and `mountain-reservoir-r1.zip`: installable and editable forms built through existing exporters.
- `authoring/fpv-worlds/demonstrations/optional/mountain-reservoir-r1-*.json`: sixteen exact-pack FPVProofArchive.v2 parts, generated only after pack SHA freezes.
- A focused offline qualifier under `scripts/`, browser fixture/evidence under `docs/evidence/`, and `docs/fpv-mountain-reservoir.md`.
- A content README with raw download links, pack-first/example-second import instructions, versions/hashes/licenses and storage limits. No automatic download/precache or change to core package descriptors.

The model is shared across all eight courses. Do not copy it eight times. The proof files are separate optional transport, not extra GLB resources or entries in the original packed demonstration registry.

## Qualification required to publish the full world

- Pin original/prepared asset provenance; repeat preparation; validate source/output glTF and semantic transforms; pack/ZIP inspect-export-import identities and exact assets.
- Validate all eight bilingual courses, both mode routes, collision clearance and visible geometry; independently complete and replay sixteen ordinary-control proofs; export/import the proof parts and repeat verification against the frozen pack SHA. No teleports, forced success or shared fake-mode proof.
- Native browser import/install/catalogue displays one new world/eight challenges; each mode's exact Watch lookup works. Render all routes and sample close scenery/terrain/gates at low/balanced/high, imported model resources and disposal/retry, with actual visible collision/clearance checks.
- Missing/corrupt model, wrong pack revision, altered course, invalid proof and absent dependency retain truthful diagnostics; restore old revision/proofs without losing bytes.
- Same-origin native IndexedDB reload and edit/export/reimport preserve the original and edited revisions. Prepare simulator offline through the supported UI; stop only the dedicated fixture server, prove connection refused, reload and launch installed Reservoir plus its retained examples. Existing D4 offline pass is useful precedent, not a Reservoir offline pass.
- Reconfirm unchanged runtime input count/bytes for data-only content. A separately changed lookup/runtime must receive its own source-bound admission, two-build equivalence and normal admitted-player qualification. No source limit/file-count changes.
- Report authored versus installed/default catalogue counts precisely. Do not claim hardware FPS, universal imported raster determinism, new water physics or completion of all four D5 worlds.

## Source references inspected

`docs/fpv-reviewed-delivery-plan.md:39` — D5 counts/scope.
`authoring/fpv-worlds/README.md:5` — offline pipeline and original source contract.
`scripts/fpv-content.mjs:126` — pinned preparation.
`optional-practice/civilian-fpv/world-content.mjs:872` — project/courses/pack data.
`optional-practice/civilian-fpv/world-app.mjs:531` — collider conversion.
`optional-practice/civilian-fpv/world-app.mjs:915` — demonstration gap.
`optional-practice/civilian-fpv/world-app.mjs:1985` — dynamic world shelf.
`optional-practice/civilian-fpv/world-app.mjs:2529` — exact installed revision entries.
`optional-practice/civilian-fpv/world-app.mjs:4578` — installed model selection.
`optional-practice/civilian-fpv/world-app.mjs:4720` — independent proof import replay.
`optional-practice/civilian-fpv/renderer.mjs:986` — visible obstacle geometry.
`optional-practice/civilian-fpv/renderer.mjs:2303` — additive imported model loading.
`optional-practice/civilian-fpv/world-model.mjs:468` — course/physics bounds.
`optional-practice/civilian-fpv/world-records.mjs:14` — proof storage/transport limits.
`optional-practice/civilian-fpv/world-visuals.mjs:1212` — presentation fallback.
