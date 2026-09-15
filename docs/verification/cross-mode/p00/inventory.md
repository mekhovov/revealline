# P00 — committed cross-mode baseline inventory

This record freezes the **integrated v0.53.0 source**, before the P00 release version bump. It inventories existing behavior; it does not deliver or approve the later redesign phases.

- Source commit: `3f8930e965132a2edb8b30c0ecd2a25294f210a8`.
- Upstream integration base: `5595b63243cdb7ec64f5d97c0e5e485b6c1fda0a`.
- The integrated delta contains the retained fullscreen feature and its test/build support. It does not modify Solo/Versus/Team simulation or production art.
- Machine-readable evidence: [inventory.json](inventory.json).
- Evidence method: source inspection, imports of pure data modules, SHA-256 of committed Git blobs, and compiled-manifest verification.
- **No browser, touch, controller, hardware, perceptual, performance, offline, or deployed-game pass is asserted by this inventory.** Those results require separate evidence and actual phase acceptance.

## Counts and coverage boundaries

| Inventory | Committed baseline |
|---|---:|
| Main content campaigns | 34 |
| Main authored level entries | 110 |
| Additional Classic Lab maps | 9 |
| Static Versus maps | 15 |
| Static Versus map/theme combinations | 51 |
| Team starter arenas | 2 |
| Presentation slots | 293 |
| Immutable presentation asset revisions | 948 |
| Presentation theme revisions | 16 |
| Collections | 1 |
| Exact picture owners | 155 |
| FPV original baseline records | 56 |
| Compiled files verified against manifest | 130 |

The 34 campaigns consist of First Signal, eight active packs, four archive packs, five optional embedded-art packs, and sixteen external chapters. The 110 entries are authored records, **not a claim of 110 distinct geometries**. Classic Lab is an additional authoring/training fixture outside those totals.

The selected presentation is `base@1` plus `fpv@15`; the sixteen theme records are base plus the fifteen immutable FPV revisions, not sixteen complete editions. The resolved 293 slots contain 135 images, 3 fonts, and 155 recipes. Quality metadata identifies 194 reviewed bindings and 99 source bindings. A recipe can be an approved component; `recipe` alone is not a missing-art finding. The 99 source bindings are not proof of completed non-FPV production.

The picture-owner inventory includes 56 FPV, 34 Ukrainian, 34 Retro, and 31 Coupa identities. Owner identity includes the base campaign key, level ID/revision, and theme ID. The existing release-picture selector is FPV-specific; matching a level name or ID alone is insufficient authority to replace artwork.

## Static Versus map matrix

First Signal exposes twelve logical maps and allows four themes: FPV Front, Ukraine Atlas, 1994 Forever, and Spend Network. Pressure Lines contributes three maps with its authored FPV presentation. Therefore the test matrix is **12×4 + 3 = 51**, not 15×4.

| Map ID | Map name | Geometry | Theme coverage |
|---|---|---|---|
| signal-01 | First Signal | 48×36 / 4:3 | All four existing themes |
| signal-02 | Relay Orchard | 48×36 / 4:3 | All four existing themes |
| signal-03 | Crosswind | 48×36 / 4:3 | All four existing themes |
| signal-04 | Stone Lanes | 48×36 / 4:3 | All four existing themes |
| signal-05 | Night Patrol | 48×36 / 4:3 | All four existing themes |
| signal-06 | Hidden Frequency | 48×36 / 4:3 | All four existing themes |
| signal-07 | The Crossing | 48×36 / 4:3 | All four existing themes |
| signal-08 | Last Light | 48×36 / 4:3 | All four existing themes |
| signal-09 | Signal Garden | 48×36 / 4:3 | All four existing themes |
| signal-10 | Supply Circuit | 48×36 / 4:3 | All four existing themes |
| signal-11 | Short Fuse | 48×36 / 4:3 | All four existing themes |
| signal-12 | Relay Storm | 48×36 / 4:3 | All four existing themes |
| orchard-crossing | Orchard Crossing | 72×36 / 2:1 | FPV |
| courtyard-exits | Courtyard Exits | 72×36 / 2:1 | FPV |
| night-crossfire | Night Crossfire | 72×36 / 2:1 | FPV |

Current sources and behavior:

- `game/couch/couch.mjs` constructs the static list from `campaign.json` and the prepared Pressure Lines pack. Both boards use `BoardPainter` and mount the presentation page.
- The twelve base maps pass empty visual overrides. Their theme-generated scenery is intentional current behavior, but they do not consult Solo’s exact-owner release-picture resolver. This is an **artwork parity gap**, not evidence of broken file downloads.
- `prepareCouchChapter` authenticates the shipped Pressure Lines pack and decodes its three embedded originals with contain fitting. Both boards borrow a single decoded binding.
- `createCouchInstalledChapters` reads the existing release/dev player channel through `createExternalChapterHost`, verifies the selected original, and owns a cancellable image binding. It exposes no writer lease, installation, progress, or recovery mutation.
- Installed choices vary by profile. The JSON lists every published source candidate and exact external descriptor, not the contents of a personal browser. Existing player guidance sends installation to Solo’s More worlds; P06 owns replacing that fragmented journey.

## Team map and role gaps

| Arena | Identity / geometry | Current presentation | Required production subject |
|---|---|---|---|
| First Connection | `first-connection`, revision 2; 72×36 | Hard-coded procedural orchard/checker cells and geometric actors | Original field/orchard operations artwork, 1152×576 |
| Relay Yard | `relay-yard`, revision 2; 72×36 | Same painter plus geometric anchors, shield/core, and warning lines | Original industrial/radio yard artwork, 1152×576 |

`createCoopPainter` is a separate read-only painter. It currently has no `setPresentation`, prepared map-art input, or decoded shared sprite binding. The Team HTML loads its own stylesheet; the host does not mount the shared presentation page. Broad `couch` screen tags in the registry therefore **do not prove Team integration**.

P04 must register and preview the explicit Team roles; P08-A must bind and inspect them in real arenas:

- Both players: normal, cutting, downed, crawling, rescuing, recovery; number and shape must reinforce colour.
- Hunter warning/charge/recovery and distinct drifter.
- Available/captured anchor; shielded/exposed/secured relay core.
- Emitter warning/spark; Support pulse; slowed enemy; rescue progress; joint capture; team recovery.

There are currently zero explicit Team role slots/bindings for those states. The JSON records all 28 required role/state entries. This finding does not deny existing procedural feedback: it identifies the missing shared presentation contract.

Co-op remains `revealline-coop.v3` with `revealline-coop-level.v1` and `revealline-coop-pack.v1`. The two starter arenas come from the source recipe compiler. Coverage and stronghold imports are explicit, validated, in-memory, at most 24 levels and 1 MiB. Historical validators reject unknown fields; new presentation metadata must not be inserted into legacy level objects.

Source inspection records the responsive stylesheet and control routes; **it does not reproduce or certify the previously reported 844×390 clipping and 390×844 target-size findings**. P03/P08-A require fresh browser measurements.

## Screens and route inventory

`inventory.json.routes` lists every committed HTML path beneath `game/`, `site/`, and `authoring/`, with title, route/review classification, dialog IDs, and a source hash. Asset inspection pages are distinguished from player routes.

The shared slot screen vocabulary has 26 entries: boot, title, missions, briefing, hangar, flight, pause, results, collection, picture, story, settings, soundtrack, library, recovery, worlds, guide, first-flight, couch, replay, controller-practice, studio, about, credits, privacy, and archive. These are **metadata coverage labels**, not a navigation test result.

Player routes include Solo, Versus, Team, Playground, Controller Lab, Replay Theater, and Profile Recovery. Secondary surfaces include the game’s native dialogs and dynamically mounted screens; the source hashes and phase ownership remain authoritative even where a surface has no separate HTML document.

## Capacity and immutable identity

| Boundary | Current limit |
|---|---|
| Presentation | 512 slots; 2,048 asset revisions; 1,024 theme revisions; 128 collections |
| Presentation transfer | 4 MiB manifest; 32 MiB bundle; 4 MiB per asset |
| Presentation image | Maximum side 1,920; maximum 2,073,600 pixels |
| Player library | 4 MiB; 512 campaign contexts; 4,096 gallery records; 1,000 scores / 10 per board |
| Installed packs | 12 packs; 24 MiB each; 48 MiB aggregate; 128 levels and 8 campaigns per pack |
| Managed media | 256 MiB; 512 assets |
| Still-media metadata | 2 MiB; 256 presentations; 512 assignments |
| Current execution catalogue | 104 authored / 208 expanded entries; 32 MiB per entry |
| Portable backup | 88,113,152 bytes |
| Core offline inventory | 64 MiB |
| Main Pages / archive | 950,000,000 / 800,000,000 bytes |

These are compatibility constraints, not permission to raise limits. New editions must account for retained revision history and media ownership, not only their current selected assets. P04/P06/P09 own bounded expansion where the new plan requires new formats or catalogue resolution.

The JSON includes SHA-256/length records for all legacy Solo and Team core modules, Versus coordination, replay/progress/library formats, source picture-owner/baseline tables, relevant render hosts, and every compiled presentation file. All 130 files listed by the baseline compiled manifest matched their declared bytes and hashes during generation.

The four historical Solo version families are retained explicitly: level v1–v4, core v2–v5, replay v3–v6, and matching checkpoint algorithms v2–v5. Any future rules change requires explicit version dispatch. Presentation changes alone must not invalidate those historical identities.

## Requirement ownership

Every phase below is queued unless a separate accepted phase record proves completion. P00 records this assignment; it does not claim their implementation.

| Phase | Owned requirements |
|---|---|
| P00 | integrated-source baseline; preserve unrelated changes/references; inventory and ownership; legacy byte identity |
| P01 | boot and all asynchronous feedback; cancel/retry/stale operation protection |
| P02 | shared master audio authority; visible sound controls in every mode and modal |
| P03 | three title modes; integrated couch lobbies; Back/Resume/input release; keyboard/touch/controller responsive navigation |
| P04 | versioned registry/extensions; Team slots and all-mode previews; sprite/upload/token tooling; history/provenance/prompts/atomic bundles |
| P05 | English/Ukrainian font coverage; shared component states; blue/yellow and compatible red/black collection; ornaments/Plain/Large/contrast |
| P06 | unified installed/downloadable catalogue; all campaigns in pack; exact identity artwork preparation; offline dependencies and controlled installation |
| P07 | one-active-solo preservation; Retry/Next/successors; Versus one-race tours and first-to-two; Team arena order |
| P08-A | shared art resolver parity; finish two Team starter maps; imported Team coverage/strongholds; all built-in and installed Versus maps; real shared actor/objective assets; canvas sizing and touch targets |
| P08-B | countdowns/transitions; capture/loss/recovery; Support/rescue/stronghold cues; reduced effects and rendering budget |
| P09 | versioned encounters/difficulty; actor domains/projectile limits; deterministic replay/checkpoint/contact/capture; optional remains preserving originals |
| P10 | two Team encounter arena editions; 36 teamwork/difficulty/encounter configurations |
| P11-A–D | 48 FPV missions, twelve per release; first complete edition presentation and Team variants |
| P12-A–D | 48 DroneAid missions, twelve per release; brandbook/logo/poster/audio/Team variants |
| P13 | 12 Living Atlas missions; complete cultural edition and Team variants |
| P14 | 12 After School Arcade missions; complete Retro edition and Team variants |
| P15 | 12 Spend in Motion missions; complete Coupa edition and Team variants |
| P16 | Collection/story/records; settings/data/recovery; learning/replay/controllers; Workshop/supporting pages; existing content curation |
| P17 | tested community guide/templates/prompts; independent fresh-workspace rehearsal |
| P18 | 792 solo configurations plus qualified Versus; 36 Team encounter configurations; required slot completeness; full regression/public/offline/budget evidence |

The 132 production missions, their qualified Versus counterparts, and two additional Team encounter editions are future deliverables. Existing Team artwork variants do not add missions to the count. All later campaigns join the map/asset matrix automatically.

For every phase, the release owner records exact source, version, staged-hunk review, six source gates, applicable builds/readiness checks, immutable artifact, public byte/source identity, actual play, findings, fixes, and retests. Required failures block the next phase. Those release claims belong to the parent acceptance record, not this source-only inventory.

## Reproducing the baseline evidence

Use the recorded source commit, even after a later release changes the working tree:

1. Read each source through `git show <recorded-commit>:<path>` and compare its SHA-256 and byte length with the JSON.
2. Parse First Signal and the active/archive/optional catalogues; read referenced pack files. Import `SOURCE_EXTERNAL_EDITIONS` and `COOP_STARTER_PACK` from a detached checkout of the same source.
3. For canonical campaign/level hashes, use the exact `canonicalJSON` implementation from that source, then SHA-256 its UTF-8 bytes.
4. Compare every `presentation/compiled/manifest.json` file entry with committed file bytes. Read `studio.json` and `runtime.json` for slot/history/quality counts.
5. Enumerate committed HTML routes with `git ls-tree -r --name-only <recorded-commit>` and extract their titles/dialog IDs. Do not substitute a personal browser’s installed state.

The inventory intentionally separates embedded originals, external originals, release-art ownership, and procedural scenes. Absence of an image in pack JSON is never, on its own, an artwork failure.
