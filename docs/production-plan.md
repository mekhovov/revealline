# RevealLine production plan

Updated 2026-09-13 after the user's renewed implementation request. **Implementation is active.** This plan supersedes earlier review pauses and priority lists, while retaining their stable step IDs and historical evidence in [the implementation register](implementation-roadmap.md). Complete and verify each milestone, commit its related changes, freeze a playable version, merge its reviewed PR, publish and verify Pages, then continue with the next milestone. Do not stop for another routine approval.

## Verified starting point

v0.30.0 is the latest published milestone: source `da573579fa10f41830e5743b4f9e7e3991e7613a`, merged through [PR #6](https://github.com/mekhovov/revealline/pull/6) as `5d854f779d9ae74c26129b5ec4f99b8878e734ca`. All **2,451 tests and six source gates** passed; main Pages run34744509726 succeeded. All **1,881 public files / 584,554,810 bytes** matched. Actual public keyboard entry, new first capture, continued simulation, Pause and exact saved restoration passed. Local frozen online/offline play and previous v0.29.2 complete-backup transfer also passed. [Final evidence](https://github.com/mekhovov/revealline/releases/download/v0.30.0/v030-delivery-receipt.json).

One upgrade edge remains in that frozen version: the earlier-progress list can omit an unfinished first flight without a saved profile. The old flight is retained and complete-backup transfer works. **P7.9 corrects discovery in v0.31**, preserving strict source validation. Earlier v0.29.2 and failed-candidate evidence remain unchanged. Browser technical delivery does not establish human enjoyment, physical-device certification, finished soundtracks, complete media authoring or the full asset catalogue.

## Requirements and behavior that must stay consistent

| Requirement                                  | Contract and delivery                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stop when reconnecting with revealed picture | A successful live cut stops the craft at safe ground. A fresh direction is required afterwards. Do not stop on every safe-ground simulation tick. Verify solo, couch, both turn modes, recovery, pause and saved continuation. P2.5 remains implemented; P2.11 rechecks it in the new chapter. |
| Tap to steer                                 | Releasing a direction continues movement during a cut. Immediate and Grid + buffer remain configurable. A wall blocks movement. Pause is explicit; returning focus does not resume.                                                                                                            |
| Harder, smarter threats                      | Author distributed field threats, contour pressure, reclaimed-ground threats, erosion and lane timing. Add optional finite pursuit/interception as an original extension, with sensing limits, warnings and cooldowns. Do not label adaptive AI as an observed XPOSED feature. P2.11/P4.7.     |
| Animated, recognizable characters            | Distinct silhouettes, facing from actual motion, readable occupied size, bounded treads/rotors/legs, and visible warning/failure states. Keep physical contact markers independent. All four themes and compact/detailed treatments use the same animation contract. P2.12/P6.                 |
| Readable line and rewarding reveal           | Bright cut head/core, travelling hit fronts, restrained motion along the unfinished cut, calmer secured contours, and capture effects behind functional actors. Optional full-picture story playback belongs to P5. P2.12.                                                                     |
| Native menus and all input devices           | One dark pixel presentation and predictable focus/Confirm/Back in title, pack selection, settings, collection, scores, help, music, replay and couch. Touch controls adapt to actual input and remain outside the arena. Authoring tools are separate. P1.14/P7.                               |
| Authored abilities and progression           | First Light Arcade stays direction-only: no manual Scan, Supply or Boost. Classic bonuses apply on contact. Tactical equipment is available only where the level's explicit policy and objectives make it meaningful. P4.                                                                      |
| Unique rewards and configurable assets       | Original pictures for each advertised map/theme, optional video/GIF stories with independent poster selection, earned Collection replay, replaceable art and bounded downloadable packs. P5/P6.                                                                                                |
| Music and player continuity                  | Session music through menus/flight/results; admin MP3s and mixed playlists; explicit browser audio activation. Preserve scores, saves, loads, collection and couch. Finish actual binary backup delivery and recovery. P3/P7.                                                                  |

The pasted earlier plans are requirements context. Their older instruction to pause for review is superseded by the latest instruction to implement and continue. Physical-device and human observations must still be reported truthfully; unavailable hardware does not stop independent development and asset production.

## Delivery phases in priority order

### A — Challenge, readability and native control (P0/P1/P2/P4)

Delivered milestone: v0.30, two independently downloadable three-map pressure chapters, preserving old First Light editions. Twenty-four legal wins and exact-source/artifact/browser/public delivery passed. Human tuning remains ongoing. [Milestone evidence](verification/round-40/v030-pressure.md).

| Step  | Status      | Player-visible result                                                    | Acceptance                                                                                                                                                                                           |
| ----- | ----------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0.5  | In progress | Updated reference comparison and concrete design decisions               | Inspect existing concepts/manual/footage; primary-source web research; distinguish observed/documented/inferred/original. Record actual listening separately.                                        |
| P2.11 | Complete    | More varied boards and credible pressure; capture stops retained         | New immutable chapter identity, authored route choices, ordinary-input wins/losses in both turn modes and Standard/Gentle, saved-prefix reconstruction, no changes to old proof results.             |
| P4.7  | In progress | Enemies can visibly acquire and commit to a limited pursuit/interception | Validated opt-in data, fixed-tick deterministic targeting, finite sensing/path work, warning/commit/cooldown, topology and freeze recovery, old absent-descriptor state unchanged.                   |
| P2.12 | Complete    | Distinct animated silhouettes and a clearly visible active cut           | Measure occupied size at desktop/phone scales; bright functional ink independent of dark theme colors; preserve colliders/checkpoints, custom-image priority, reduced effects and readable warnings. |
| P1.14 | In progress | Remaining player surfaces use predictable keyboard/controller navigation | Replay Theater corrected in v0.30. Continue auditing nested dialogs, settings, results, guide and couch; whole keyboard journeys and finite controller-host tests; physical tests separately.        |
| P7.8  | Complete    | Published challenge/presentation milestone                               | Full applicable source gates, actual browser play beyond capture, independent artifact reproduction, reviewed PR, Pages/public-byte checks and live-site play.                                       |

Difficulty is evaluated by choices and failure causes, not only enemy speed. Keep the introduction readable, increase interaction between threats gradually, and preserve fast expert solutions. Automated route proofs establish solvability and consistency, not human enjoyment. Continue collecting human feedback without blocking work already authorized.

### B — Finish sound library and reward-media infrastructure (P3/P5)

1. Close P3.1–P3.3 with actual MP3 import, ordered/shuffled/mixed playlists, repeats, assignments, session continuity and error recovery. The explicit download flow now passes local UI download, different-origin import/save/re-export with exact original bytes, and development-packaged cold offline startup/playback. v0.31 exact-source, frozen and public delivery gates follow; [round 41](verification/round-41/v031-media.md) keeps these stages separate.
2. The independent still-image API and opt-in v3 store are implemented and tested, without runtime adoption. Stored exact owners preserve history across restart and pack removal; original bytes share the bounded ledger with music. Model tests cover migration, cancellation, stale writes and quota refusal. Qualify actual browser upgrades and recovery before enabling them normally. A failed import preserves the working edition.
3. Deliver per-map image replacement, video/GIF upload, scrubbing, independent poster and story segment selection, partial-reveal previews and optimized runtime derivatives. Preserve original uploads.
4. Win records progression first, reveals the full earned picture, optionally plays the story from its beginning, then returns to that exact picture. Skip/replay never duplicates awards. Keep earned still images independently available when optional story media is removed.
5. Validate complete media backup/import, pack editing/replacement/removal and optional offline chapter/theme bundles. Existing JSON-only backups are not advertised as full soundtrack/video backups.

### C — Tactical interactions, reusable generators and campaign variety (P4/P6)

1. Deliver small teaching scenarios for scouting, carrier payload/supplies, signal interference/fiber resistance and vulnerable trails, impact/redeployment, interception, nets, hangar changes and authored objectives. Add missing registered primitives with tests before advertising them. Military-inspired roles remain abstract game systems.
2. Give each role Spot / Risk / Counterplay guidance and a real practice scene. Keep practice non-awarding and preserve the parent's paused flight and music ownership.
3. Expand authored challenges: separated field pockets, alternating corridors, contour pursuit, erosion recovery, slow/lethal routing, pickup detours, timed lanes and staged boss openings. Introduce one main decision at a time before combining it.
4. Build a seeded wide-map generator and CLI with explicit generator revision, bounded recipes, spawn/domain/reachability validation and reproducible output. Saved generated maps retain their concrete data and identity. Generation is not a solvability certificate; verification produces legal input traces separately.
5. Finish Gentle/Standard/Expert, exact Arcade/Tactical recipes, optional clean/speed mastery, chapter progress and earned craft presentations. New settings never reinterpret a live run or old recorded rules.

### D — Complete original art, animation and music production (P6)

Use the established playable mechanics and media pipeline to produce a consistent modern pixel-art catalogue. Review supplied concepts and drone examples for silhouette and style; reuse owned source material only with recorded provenance. Public reference material informs original artwork rather than becoming copied game sprites or music.

| Target                         | Required output                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 29 wide campaign maps          | Authored progression, explicit mechanics, goals and actual legal wins for every advertised mode                             |
| 116 map/theme pictures         | One distinct original reward for every map across FPV Front, Ukraine Atlas, 1994 Forever and Coupa                          |
| 12 victory stories             | Three per theme; inspected animation/video, skippable and replayable from Collection                                        |
| 40 reserve illustrations       | Additional reviewed content, excluded from automatic runtime downloads                                                      |
| 56 character presentation sets | Seven roles × four themes × two detail treatments; configurable independent parts and inspected animation                   |
| 24 finished tracks             | Predominantly 80s/90s synth, with chiptune, rock and metal; rendered and auditioned, separate from MP3-upload support       |
| Complete supporting assets     | Enemy/terrain/pickup/UI/focus/achievement/recovery/victory/SFX/promotional assets, explicit inventory and theme consistency |

Every item has an ID, source, license/provenance, theme/role, actual dimensions/duration, replacement interface, production stage and inspection result. Prompt text, generated contact sheets, procedural placeholders and unplayed audio are not counted as finished assets.

### E — Browser product qualification and publication (P7)

Run complete keyboard/mouse/touch/controller journeys through new/continued play, all menus, loss/retry, completion/Collection, score/save/backup, pack and media operations, and couch play. Test portrait/landscape phones, tablets, desktop and handheld layouts; record actual physical-device results separately from viewport emulation.

Measure sustained performance toward 60 fps on ordinary hardware, memory, lifecycle/audio interruption, storage recovery and offline behavior. Complete credits, help, privacy information, deployment/rollback and a truthful support matrix. Human challenge/comprehension/comfort/replay observations remain distinct from technical gates.

### F — Native distribution (P8)

Complete iPhone/macOS/Steam wrappers independently: lifecycle, files, audio sessions, controller text entry, packaging/signing and store requirements. Remediate the tracked isolated native-tooling dependency before qualification. Missing signing/store access is a specific external dependency; do not infer native readiness from a browser release.

### G — Online multiplayer (P9, later extension)

Private authoritative races, reconnect and network-failure handling follow the browser product. Couch remains supported throughout. Online matchmaking, cloud saves and global rankings have separate identities and deployment needs; they do not block the initial browser release.

## Current correction — P7.9 / v0.31

The transfer picker now discovers exact suspended-slot keys as well as library keys. An absent profile may contribute default preferences and an empty collection only when its saved flight fully verifies; malformed or missing sources still reject. Gentle expansion is forwarded through the existing backup verifier. The preview explains the empty collection before explicit Copy. Focused source/finite-host tests pass; frozen and public verification remain mandatory. This correction ships with the explicit soundtrack-download flow and opt-in still-media foundation.

## Framework, tools and tracking

Retain frontend-friendly JS/Phaser, deterministic fixed-tick rules, versioned optional primitives and validated data packs. Keep all earlier core/replay/pack readers and immutable editions. Media and cosmetic identities do not change score authority. Ordinary content updates compose registered behavior; arbitrary uploaded code is not a pack format.

Keep the current bounded storage contracts; do not enlarge caps silently to fit production. Ship optional media chapters, preserve rollback and account for staging. The [media design](media-library-design.md), [audio guide](soundtrack-library.md), and actual validators define implemented versus proposed formats.

Update project skills, prompt examples, authoring scripts/CLIs, catalogues and documentation with each implemented interface. Include examples for new themes, actors, pressure recipes, maps, image/style replacement, animation, stories, playlists, backup and release qualification. Existing source images are not overwritten.

Each milestone records stable step ID, priority/status, changed behavior, acceptance evidence, playable version and remaining issue. A feature is complete only at its stated gate. The release workflow is **commit → source verification → immutable snapshot → artifact/browser verification → PR/CI/merge → Pages/public verification → release receipt**. Keep failed candidates and older tags intact. Continue to the next authorized milestone after a successful delivery.
