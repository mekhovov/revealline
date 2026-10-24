# Catalogue damage ownership audit

20 October 2026. Source inventory and focused ownership checks during the HUD/actor integration. This is not a visual or physical-device qualification.

## Inventory

[Machine-readable rows](catalogue-damage-ownership.json) contain every shipped course's exact source identity and each authored actor's stable ID, type and effective role. IDs are scoped to their course.

| Scope | Courses | Authored actor occurrences |
| --- | ---: | ---: |
| Native catalogue | 134 | Included below |
| Learning variants | 58 | Included below |
| Legacy Academy | 12 | 0 |
| Total | 204 | 357 across 118 courses |

| Authored type / role | Count |
| --- | ---: |
| Patrol / hostile | 263 |
| Patrol / civilian | 19 |
| Vehicle / hostile | 13 |
| Vehicle / civilian | 9 |
| Drone / rival | 13 |
| Drone / hostile | 9 |
| Sentry / hostile | 7 |
| Hazard / no role field | 24 |

There are also 24 pinned regional revisions across 13 region IDs. The regional presentation-course adapter has an empty authored actor list; a combat encounter supplies its own admitted actors. These counts do not inspect the downloaded scenery bytes.

## Ownership paths

| Path | Runtime authority and visible ownership |
| --- | --- |
| New native / learning original activity | Worlds supplies `LIVE_ACTOR_RULES` (`destructible-subjects.v1`) to `createWorldFlight`, or through `createAircraftCourseSession` for Advanced. All active actor types/roles enter the damage query. Civilian/rival roles control behavior, not invulnerability. |
| Required Hunt / tracking subject | A defeated subject needed by the current or a later objective waits 250 accepted ticks, then receives a new generation only at a safe authored spawn/path position. Logical credit prevents repeated reward for the same subject. This is covered by the separate live-actor regression file. |
| Legacy Academy original activity | All 12 shipped sources have no actors. Historical replay identities retain their recorded rules; new combat uses the encounter path. |
| Native / legacy / downloaded combat | `createEncounterDefinition(...version:2)` transfers every authored actor before filling procedural slots, retaining its ID and making it destructible. It can relocate an unsupported authored route using bounded admission, or fail visibly. `encounterPhysicsCourse` has no actors, preventing a second simulation owner. |
| Regional combat | The regional geometry adapter admits encounter actors after terrain preparation. Original regional free flight has no native actor list. |
| Downloaded editable packs | `downloadedEntry` resolves the installed exact pack identity. Imported `extras.rl.kind:'actor'` anchors become `course.actors`; normal native/combat ownership then applies. User-installed packs were not enumerated by this audit. |
| Imported scene mesh | `applyImportedActorOwnership` hides a scene subtree only when explicit `userData.rl.kind/type === 'actor'` and its stable `rl.id` is owned by the native or encounter actor list. Clearing ownership restores original visibility. Names alone do not grant actor ownership. |

Relevant implementations: `world-app.mjs` (`courseFromProject`, `downloadedEntry`, native/Advanced launch and regional launch), `world-model.mjs` (`LIVE_ACTOR_RULES`, `damageActor`, `replaceSubjects`, projectile candidates), `encounter-runtime.mjs` (`createEncounterDefinition`, `encounterPhysicsCourse`), `renderer.mjs` (`applyImportedActorOwnership`, `syncImportedActors`), and `regional-session.mjs` (`regionalReviewEntry`), all under `optional-practice/civilian-fpv/`.

## Finding and limits

- **Resolved imported metadata identity override:** `courseFromProject` now applies settings before the canonical marker ID, transformed position and declared actor type. The focused regression supplies conflicting settings and confirms the runtime retains the mesh's `extras.rl.id` while preserving ordinary settings such as role/health.
- No additional procedural character factory was found in `world-visuals-source.mjs`; its geometry is scenery. This source lookup cannot prove that every unannotated imported GLTF mesh is non-character art. Such meshes require explicit actor metadata or should be treated/documented as scenery.
- The ownership projection check uses an identity admission callback to isolate actor transfer. It does **not** establish obstacle clearance, attack reachability, mesh hitboxes, or human-perceived damage readability. Those require their existing geometry and browser evidence.
- Historical replays remain historical. Live continuation migration and new proof formats have their own tests and must not be inferred from these inventory checks.

## Verification

`game/test/fpv-catalogue-damage-ownership.test.mjs`: **3 passed**. It inventories all 204 sources, checks per-course uniqueness and type/role domains, then confirms all 357 authored actors are transferred exactly once into the new encounter owner across 118 actor-bearing courses. Native physics actor arrays are empty in that combat projection, and source objects remain unchanged. The third check covers conflicting imported actor settings.

The small collector is [catalogue-damage-ownership.mjs](catalogue-damage-ownership.mjs). It imports data only and does not download scenes, run physics, open browsers or access user storage.

## Host continuation and route follow-up

Mounted-host regressions now verify historical proof preservation, unscored Continue, exact-boundary Watch of a continuation suffix, immutable Watch export, continued suffix export/autosave, and reimport of the saved Acro industrial course. The original proof is pinned before migration; Watch starts at its verified boundary tick and does not append historical frames. Continuation labels explicitly say unscored practice.

The route host selects the current objective/mode through the admitted-guide selector and checks the actual aircraft radius. A mounted regression covers a standard aircraft, a mode without a route, and a larger physical aircraft that cannot fit the authored corridor. Admission results are assigned only after rechecking the launch owner. Unavailable Studio graphics cannot interrupt subsequent form refreshes.

The full host/route/editor run found one obsolete population expectation: new live Studio encounters now preserve all 20 authored actors when six were requested. That expectation was updated; the targeted roster regression and six continuation/route/editor regressions pass. Earlier six-of-twenty historical recovery semantics remain covered separately by the runtime tests. These checks use fixture rendering and are not browser visual, device, or performance qualification.

The subsequent [final eight-file regression run](final-route-continuation-regressions.md) passed **232/232** with unchanged source hashes. It includes the corrected population expectation plus independent stale-guide repair, bounded continuation recording without stopping flight, and detached recovery cleanup when original-proof storage fails.
