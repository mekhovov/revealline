# RevealLine production plan

Updated 2026-09-13 after the user's renewed implementation request. **Implementation is active.** This plan supersedes earlier review pauses and priority lists, while retaining their stable step IDs and historical evidence in [the implementation register](implementation-roadmap.md). Complete and verify each milestone, commit its related changes, freeze a playable version, merge its reviewed PR, publish and verify Pages, then continue with the next milestone. Do not stop for another routine approval.

## Verified starting point

v0.31.0 is the verified published/latest milestone: source `70c67e172ceb39947b442948add0d745b19f9a29`, merged through [PR #7](https://github.com/mekhovov/revealline/pull/7) as `b53f7d4728852b647254c501bd384cf95d970e6d`. All **2,506 tests and six source gates** passed. [Main Pages run 34747037720](https://github.com/mekhovov/revealline/actions/runs/34747037720) and its deployment succeeded; the independent audit matched **2,117 public files / 688,163,158 bytes**, including all nine hidden metadata files, with no failures, retries or skips. Source, artifact and public-byte verification are distinct from browser observations. [Final v0.31 delivery receipt](https://github.com/mekhovov/revealline/releases/download/v0.31.0/v031-delivery-receipt.json).

P7.9 now passes the actual public earlier-flight journey: the v0.29.2 suspended-only source is discovered, its preview explains default preferences/empty collection, and explicit Copy/Load restores **51.4% / 12,240 points / three lives / 1:47, paused**. The original edition remains intact. A fresh public Pressure Lines cut also reaches **51.5% / 12,060 / three lives / 2:29**, stops on capture, continues world simulation and reloads to the same paused state. The explicit `.rlsound` download, fresh-origin restore, byte-identical re-export and packaged cold-offline playback milestone is verified; the 26-second coded-silence fixture is transport evidence, not a finished music track. [Earlier source/browser preflight](verification/round-41/v031-media.md) is a historical pre-freeze record; [current evidence and remaining boundaries](research/round-42-native-media.md) supersede its pending delivery notes.

v0.30's limited pursuit, pressure chapters and actor/trail presentation remain complete at their stated scope. Preserve older release receipts and failed-candidate evidence. Human enjoyment, physical-device certification, 24 finished tracks, complete media playback and the full asset catalogue remain open.

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
| Music and player continuity                  | Session music through menus/flight/results; admin MP3s and mixed playlists; explicit browser audio activation. Preserve scores, saves, loads, collection and couch. v0.31 verifies explicit soundtrack binary delivery and recovery; paired picture/story backup remains P5. P3/P7.            |

The pasted earlier plans are requirements context. Their older instruction to pause for review is superseded by the latest instruction to implement and continue. Physical-device and human observations must still be reported truthfully; unavailable hardware does not stop independent development and asset production.

## Delivery phases in priority order

### A — Challenge, readability and native control (P0/P1/P2/P4)

Delivered milestone: v0.30, two independently downloadable three-map pressure chapters, preserving old First Light editions. Twenty-four legal wins and exact-source/artifact/browser/public delivery passed. Human tuning remains ongoing. [Milestone evidence](verification/round-40/v030-pressure.md).

| Step  | Status      | Player-visible result                                                    | Acceptance                                                                                                                                                                                                |
| ----- | ----------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0.5  | In progress | Updated reference comparison and concrete design decisions               | Inspect existing concepts/manual/footage; primary-source web research; distinguish observed/documented/inferred/original. Record actual listening separately.                                             |
| P2.11 | Complete    | More varied boards and credible pressure; capture stops retained         | New immutable chapter identity, authored route choices, ordinary-input wins/losses in both turn modes and Standard/Gentle, saved-prefix reconstruction, no changes to old proof results.                  |
| P4.7  | Complete    | Enemies can visibly acquire and commit to a limited pursuit/interception | Delivered in v0.30: opt-in finite sensing and locked routes, warning/commit/cooldown, topology/freeze recovery and old absent-descriptor compatibility. This does not complete Tactical roles/objectives. |
| P2.12 | Complete    | Distinct animated silhouettes and a clearly visible active cut           | Measure occupied size at desktop/phone scales; bright functional ink independent of dark theme colors; preserve colliders/checkpoints, custom-image priority, reduced effects and readable warnings.      |
| P1.14 | In progress | Remaining player surfaces use predictable keyboard/controller navigation | Replay Theater corrected in v0.30. Continue auditing nested dialogs, settings, results, guide and couch; whole keyboard journeys and finite controller-host tests; physical tests separately.             |
| P7.8  | Complete    | Published challenge/presentation milestone                               | Full applicable source gates, actual browser play beyond capture, independent artifact reproduction, reviewed PR, Pages/public-byte checks and live-site play.                                            |

Difficulty is evaluated by choices and failure causes, not only enemy speed. Keep the introduction readable, increase interaction between threats gradually, and preserve fast expert solutions. Automated route proofs establish solvability and consistency, not human enjoyment. Continue collecting human feedback without blocking work already authorized.

### B — Optional original worlds, then safe runtime media adoption (P3/P5/P6)

1. **Close the bounded v0.32 optional-worlds integration first.** Four three-map theme variants use **12 unique original pictures and three reused R5 layouts**. The compiler preserves original PNG bytes, existing direction-only rules and music, and gives every new pack/campaign/map a distinct identity. Forty-eight actual Standard/Gentle wins across both turn modes include saved-prefix reconstruction. This is a themed variation milestone, not 12 new geometries or completion of the 29-map/116-picture production target. [Compiler, provenance and proof contract](../authoring/library/four-worlds-chapters/README.md).
2. **Finish optional publication and native install qualification.** The four normalized packs total **44,439,900 bytes** within the unchanged 48 MiB installed-library limit; other installed chapters share that space. Each source image fits 4 MiB and each pack fits 24 MiB. Explicit opt-in publication may add complete pack bytes to the site/ZIP while excluding them from automatic core offline preparation. Keep the 64 MiB core cache cap, small catalog, lazy download, verified installed-art identity, separate Install/Choose and explicit backup/removal on capacity refusal. Never evict a pack automatically. The native/build implementation passed 68 affected Node 22 and 17 focused Node 20 tests. Root also checked a source-preview Ukraine flight, installation of Retro without resetting it and reload/Continue. Frozen, stopped-server optional-world and public delivery gates remain pending; this plan does not claim a v0.32 deployment. [Optional-worlds implementation evidence](optional-worlds.md) and [native media research](research/round-42-native-media.md).
3. **Adopt the implemented P5 foundations through a separate runtime gate.** The isolated media work implements the explicit shared-v3 still workshop, bounded partial-reveal preview, `.rlmedia` binary inventory/restore, immutable generic-reference additions, per-flight picture pins and first-earned receipt models. These are separate from ordinary v0.31 behavior. Keep live picture acquisition/adoption, Collection display, exact execution-to-authored-owner validation, paired backup ordering and browser/offline qualification pending until their integrated journeys pass. A failed import, missing original, cancelled decode or stale writer must preserve the working flight and owned bytes.
4. **Retain the completed P3 download milestone.** Explicit native download → fresh-origin import/save → exact re-export and packaged cold-offline MP3-to-synth playback have passed. Keep ordered/shuffle/repeat/assignment and interruption qualification scoped to actual evidence. Finish 24 rendered and auditioned tracks separately under P6.3; upload support and coded silence do not count toward it.
5. **Then extend to stories and the complete media workflow.** Add video/GIF upload, scrubbing, independent poster and story-segment selection, previews and bounded derivatives while preserving original uploads. Record the win once, reveal the earned still, optionally play the story from its beginning, and return to that exact still. Skip/replay never duplicates awards. Validate paired game-data/original-media recovery before advertising a complete backup; current `.rlsound`, `.rlmedia` and JSON files cover different inventories.

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

## Completed correction — P7.9 / v0.31

The transfer picker discovers exact suspended-slot keys as well as profile keys under the existing bounds. Only an explicitly absent profile paired with a fully verified saved flight contributes default preferences and an empty collection. Corrupt, undefined and entirely absent sources reject. Source locks, journals, deduplication, Gentle expansion and copy-time fingerprint validation remain authoritative. Focused regression tests and the actual public paused restore above passed. v0.31 also delivers the explicit soundtrack download; its included still store remains opt-in and does not silently replace runtime artwork.

## Framework, tools and tracking

Retain frontend-friendly JS/Phaser, deterministic fixed-tick rules, versioned optional primitives and validated data packs. Keep all earlier core/replay/pack readers and immutable editions. Media and cosmetic identities do not change score authority. Ordinary content updates compose registered behavior; arbitrary uploaded code is not a pack format.

Keep the current bounded storage contracts; do not enlarge caps silently to fit production. Ship optional media chapters, preserve rollback and account for staging. The [media design](media-library-design.md), [audio guide](soundtrack-library.md), and actual validators define implemented versus proposed formats.

Update project skills, prompt examples, authoring scripts/CLIs, catalogues and documentation with each implemented interface. Include examples for new themes, actors, pressure recipes, maps, image/style replacement, animation, stories, playlists, backup and release qualification. Existing source images are not overwritten.

Each milestone records stable step ID, priority/status, changed behavior, acceptance evidence, playable version and remaining issue. A feature is complete only at its stated gate. The release workflow is **commit → source verification → immutable snapshot → artifact/browser verification → PR/CI/merge → Pages/public verification → release receipt**. Keep failed candidates and older tags intact. Continue to the next authorized milestone after a successful delivery.
