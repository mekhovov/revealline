# Reveal Line cross-mode execution register

Approved scope: **consistent maps and presentation across Solo, Versus and Team**, followed by complete edition production. This register implements the user's revised P00–P18 plan. It supersedes earlier phase ordering, not historical release evidence or ownership. Updated 15 September 2026.

**Release gate: P01 — loading feedback.** Verified public baseline is **v0.57.1**, source `4c85277ac7393eeeabab035387d4d4ae8734aba1`: its accepted records report 4,187 tests and 2,398 deployed files. P00 remains accepted in v0.55.0. v0.57.1 corrects offline progress visibility; Library/craft/focus corrections for v0.57.2 remain owned by the separate P01 task. A candidate, unit-test pass or uploaded artifact alone does not close P01.

**Next implementation: P02-A — shared master sound.** The user approved the audited player-experience-first sequence on 15 September. Independent code is being prepared on `codex/p02a-shared-audio` against the immutable v0.57.1 source. Integration, final qualification and publication depend on P01 acceptance. Its [implementation and acceptance contract](shared-master-audio.md) distinguishes implemented code from browser, audible and device acceptance.

Approved delivery order: **P01 → P02-A → P03 → P05 → P08-A → P08-B → P09 → P07 → P02-B → P04 → P06 → P10 → P11-A–D → P12-A–D → P13 → P14 → P15 → P16 → P17 → P18**. Native stores and online multiplayer stay deferred. The early presentation phases use compatible registry entries and read-only Team adapters; complete Studio expansion stays in P04.

The [P01 loading contract](presentation-loading.md) documents the implemented shared presenter, operation ownership and required regression cases. It applies to later phases; phase acceptance remains separate from this implementation description.

## Baseline and preservation

The starting user checkout was `codex/fpv-redesign` at `677b091681d424198de17c6f7e864795d2618880`, with mixed staged, unstaged and untracked work. Its index, binary patches and 201 changed/reference files (629,522,202 logical bytes) were preserved locally at `.cache/cross-mode/p00-preservation-20260915T051513Z` in that checkout. `preservation.json` records each file's SHA-256. The original checkout remains untouched.

Implementation uses the separate `codex/cross-mode-p00` worktree. The initial integration cutoff is main `5595b63243cdb7ec64f5d97c0e5e485b6c1fda0a`. The first rebase result is `3f8930e`:

| Original work                                      | Disposition and reason                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `4c9ae09` design atlas                             | Equivalent atlas, fonts and evidence are already upstream via `fc789c7`; retain newer main improvements.                                                     |
| `76b0498` gesture audio and `677b091` iPhone audio | Already upstream; Git dropped equivalent changes during rebase.                                                                                              |
| `912a0f7` fullscreen/PWA                           | Retain display-mode detection, lifecycle listeners, manifest/Apple metadata and adapter tests. Keep current main responsive styles and version files.        |
| Old fullscreen CSS                                 | Do not adopt HUD-over-arena positioning, hidden status or 10px telemetry. P03/P08-A qualify layout against the current control-clearance contract.           |
| Four staged audio reversions                       | Unstaged restorations cancel them exactly. Do not stage the stale reversions.                                                                                |
| Older presentation/compiler/Studio drafts          | Preserve locally; current main contains later implementations and stronger validation. Reconcile useful missing work individually within its assigned phase. |
| Reference and concept files                        | Preserve as research/source material; do not automatically publish as runtime art. The untracked title PNG duplicates the upstream original.                 |

At the original inventory cutoff the source package was v0.53.0 and the latest published stable observed was v0.52.0. v0.53.0 was already tagged and v0.54.0 had a concurrent candidate in PR #49. Neither version was reused: P00 allocated v0.55.0 after checking remote tags, and subsequently completed its release and public acceptance recorded above.

Production reproduction exposed a stale ledger on the integration cutoff. P00 adopts the six production files from PR #49 source `1af33851e93ee95110de20cc73622ed43d85a4da`: generator, production-history test, source bundle and three compiled JSON files. Review confirmed preservation of all 948 historical asset records, 16 theme revisions, one collection and 127 original asset blobs. The repair appends 34 asset and two theme revisions and pins reviewed motion/effect approvals to exact source fingerprints. Earlier checks on that candidate do not qualify the combined P00 source. The inventory remains a faithful pre-repair baseline; final receipts record the adopted delta.

After PR #49 merged, P00 integrated main `a6406ed` through a normal merge, preserving the first P00 candidate `9a9fc8f` and inventory commit `3f8930e` as reachable history. Only the three version files conflicted; P00 retains v0.55.0. Runtime, content and production bytes remain identical to `9a9fc8f`. The final merge receives fresh exact-source gates; earlier candidate checks remain scoped evidence. Release coordination assigns the separate player-library/Team-controls candidate to v0.56.0, without including its unfinished work in P00. Reconcile that incoming release before changing its affected surfaces in later phases.

The [source inventory](verification/cross-mode/p00/inventory.md) and [machine-readable inventory](verification/cross-mode/p00/inventory.json) distinguish embedded originals, external originals, release-art bindings and intentional procedural scenes. Source counts do not establish browser or physical-device coverage.

## Phase and acceptance register

Statuses are `queued`, `implementing`, `reviewing`, `qualifying`, `deployed`, `accepted`. A required failure blocks advancement. Post-publication corrections require a new patch release; frozen bytes and tags are immutable.

| Phase | Status       | Independently releasable deliverable                                                                               | Blocking acceptance                                                                                                                                |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| P00   | accepted     | Preserve and integrate relevant work; inventory screens, maps, content paths, assets and compatibility.            | Reproducible baseline, preserved historical saves/art/releases, every requirement assigned below; exact-source and public release proof.           |
| P01   | implementing | Immediate loading feedback across boot, launch, download, preparation, recovery, media and Studio.                 | Slow/failure/cancel/retry/cached/stale completion journeys preserve state.                                                                         |
| P02-A | implementing | Shared master mute and volume for all existing output paths; explicit controls across modes and previews.          | Deferred-play/native-control races, transport/fader preservation, navigation persistence, actual browser/audio verification and public acceptance. |
| P03   | implementing | Single player, Couch Versus and Couch Team entry; integrated lobbies and Back/Resume.                              | Direct Solo Start/Continue, mode-plus-Start Couch entry; keyboard/touch/controller routing and responsive controls.                                |
| P05   | queued       | Shared typography, Ukrainian palettes, ornaments, components and Team shell.                                       | Actual EN/UA glyphs, contrast, Large/Plain text, zoom, focus, reduced motion and affected screens.                                                 |
| P08-A | queued       | Complete existing map presentation parity, imported Team rendering, Versus art resolution and canvas fit.          | All ten map-consistency gates below. Existing Team maps cannot wait for P10.                                                                       |
| P08-B | queued       | Countdown, cut/capture, loss/recovery, Support/rescue, objective/HUD feedback and reduced effects.                 | Readability in motion, unchanged historical outcomes, performance and responsive checks.                                                           |
| P09   | queued       | Versioned auxiliary patrols/carriers/shooters, difficulty, defeat, telegraphs, remains and replay/checkpoints.     | Small deterministic compatibility slice before bulk content.                                                                                       |
| P07   | queued       | Direct Retry/Next, clear endings, one-race Versus tours, optional first-to-two and Team order.                     | No duplicate scoring; failed Next retains results; named successors; independent Solo progress.                                                    |
| P02-B | queued       | Complete custom MP3s and mixed playlists in advertised modes; finished synth/chiptune/rock/metal collection.       | Actual track listening, transfer, offline playback, missing/corrupt recovery and mode parity; candidate album is not accepted content.             |
| P04   | queued       | Five-edition registry, explicit Team slots, cross-mode Studio previews, bindings, editing/history/prompts/bundles. | Real upload/edit/save/export/import, exact byte round trip, invalid/stale/capacity/atomic failure handling.                                        |
| P06   | queued       | Unified compatible-content catalogue, controlled installation and shared art preparation.                          | Every campaign selectable; correct Download & play; failure/staleness preserves selected content and saved flight.                                 |
| P10   | queued       | Encounter variants of First Connection and Relay Yard.                                                             | Separate 36-case Team matrix; Support/rescue/stronghold/two-player readability.                                                                    |
| P11-A | queued       | FPV First Contact, twelve missions.                                                                                | Complete first-edition assets and compatible modes; campaign production/playability/progression/public gates.                                      |
| P11-B | queued       | FPV Crossing Lines, twelve missions.                                                                               | Same independent campaign gates.                                                                                                                   |
| P11-C | queued       | FPV Signal Pressure, twelve missions.                                                                              | Same independent campaign gates.                                                                                                                   |
| P11-D | queued       | FPV Last Relay, twelve missions.                                                                                   | Same independent campaign gates.                                                                                                                   |
| P12-A | queued       | DroneAid Community Connections, twelve missions.                                                                   | Complete brand/animated logo/poster and mode assets; Support framing and campaign gates.                                                           |
| P12-B | queued       | DroneAid Supply Corridors, twelve missions.                                                                        | Support framing and independent campaign gates.                                                                                                    |
| P12-C | queued       | DroneAid Contested Signal, twelve missions.                                                                        | Clearly labelled Combat framing and independent campaign gates.                                                                                    |
| P12-D | queued       | DroneAid Return Signal, twelve missions.                                                                           | Clearly labelled Combat framing and independent campaign gates.                                                                                    |
| P13   | queued       | Living Atlas, twelve culture/history missions.                                                                     | Complete edition, cultural/art review, variety, applicable modes and release checks.                                                               |
| P14   | queued       | After School Arcade, twelve Retro missions.                                                                        | Complete edition, distinct encounters/art/audio, cross-mode and release checks.                                                                    |
| P15   | queued       | Spend in Motion, twelve Coupa missions.                                                                            | Complete edition, clear noncombat semantics, cross-mode and release checks.                                                                        |
| P16   | queued       | Collection, settings/data/recovery, learning, replay, workshops, supporting pages and legacy categories.           | Full navigation/state coverage; originals and historical content preserved.                                                                        |
| P17   | queued       | Community guide, prompts, templates, compatibility and release workflow.                                           | Independent fresh-workspace example created, installed, played and recovered.                                                                      |
| P18   | queued       | Full cross-phase/edition/content/accessibility/performance/offline/public regression.                              | No unresolved required content, slot or acceptance item.                                                                                           |

Queued means phase acceptance is outstanding; it does not erase delivered foundations. The audited baseline retains partial saves/scores/Collection/backups, 15 of 29 map families (60 of 116 pictures), one of twelve stories, incomplete animated presentation sets, five synthesized runtime recipes, thirteen authoring skills, and partial Versus/Team play. Forty reserve originals are accepted as source art, not installed missions. Another three picture families and the 24-track album are candidates. The 132 new Solo missions remain a production backlog; bulk production follows the three-level gameplay benchmark.

P03-A, P03-B, P03-C, P03-D, P03-E, P03-F, P03-G and P03-H are internal work packages within approved **P03**, not separately accepted public phases. This branch retains scoped desktop keyboard evidence for A/B/C/D/E/F/G/H. P03-D's story-focus work is integrated here after E; F is the modal Tab-boundary candidate below; G adds guarded unfinished-mission replacement with the scoped evidence below; H is the starting-setup candidate below. The public baseline remains v0.57.1. P03 stays implementing until combined-source, public and device gates close.

## P03-A actual-opener candidate

This isolated source candidate keeps Workshop and its parent menu open beneath Scores & saves and How to play. Closing either child by its button, Escape or controller Back returns focus to its actual Workshop opener; another Back returns to the menu. A paused flight stays paused with its checkpoint intact. Successful explicit Library play/challenge selection or saved-flight loading instead closes both retained parents before focusing the chosen or restored flight; it still does not implicitly start or resume it.

Existing Solo and Versus Team links now declare a code-owned return context. Team's visible lobby return link and lobby Escape/controller Back use that same destination. Direct, unknown or ambiguous contexts retain the existing Versus fallback; supplied URLs and browser history are not return authority. This is a cross-document return, not restoration of the previous page's exact menu/focus or an automatic Resume. Team's paused Back still focuses Resume together without leaving or starting play.

This candidate does not accept all P03: native/public qualification, entry redesign, integrated lobby, departure confirmations and broader progression remain separate work. Root-reported follow-ups include confirming replacement of an unfinished Solo flight and preserving a meaningful focus target when a story ends and Pause becomes Replay; neither behavior is changed here. Existing direct-flight dialog openers and explicit flight starts keep their current behavior.

## P03-B initial-focus candidate

The Solo title's initial focus handoff waits until boot has revealed the game, chooses a visible enabled control, and preserves an already meaningful focus choice. A saved flight exposes Continue without loading or resuming it. Hidden lesson controls stay hidden; a disabled primary action falls back to the next available menu control. Background pages do not claim focus. Native qualification remains pending for this candidate.

Exact cross-document Missions/opener restoration and unfinished-flight departure confirmation remain separate work; P03-A's code-owned Solo/Versus destination does not preserve the old document's menu state.

## P03-C Solo Missions → Team return candidate

A deliberate Team entry from Solo Missions retains a bounded one-use tab record with exact installed campaign, mission and theme identities. Team Back uses only the fixed Solo route. Once Solo is ready, a compatible record reopens Missions and Mode with the Team link focused; it never installs content, loads a saved flight, resumes play or changes player progress. Missing, expired, consumed, ambiguous or incompatible records fall back to the visible title. Release records bind the build's source revision, version and channel; source previews with no build revision are limited to their origin/version/channel and are not frozen-source proof.

An unfinished Solo flight pauses before the departure check. The existing checked flight-retention helper verifies replay/checkpoint and actual storage readback under the backup lock. Stay, Escape and controller Back return to the Team opener without resuming. Leave stays unavailable while checking. A failed check remains in Solo and warns that leaving may lose the session-only attempt; only a subsequent explicit Leave permits departure. An externally changed saved slot is preserved, and a later changed slot invalidates the earlier saved claim. The save hold lasts through pagehide and ends at explicit Resume or a new attempt. A post-write failure cannot claim the older slot is unchanged.

Ready and finished attempts keep direct Team entry when the return record is available. If tab storage is unavailable, a separate explicit Leave choice uses the fixed Team → Solo-title fallback; return metadata never blocks Team permanently. This isolated candidate still needs native and integrated release qualification. Confirmation when starting a different mission, browser-history restoration, Versus departure redesign, integrated mode lobbies and story transport focus are separate slices.

## P03-E Team initial-focus candidate

After Team enables Start and reports ready, an untouched foreground page chooses its visible enabled default through the shared navigation filter. This is a one-shot keyboard focus handoff, without enabling controller ownership or starting play. A deliberate preload or late focus choice, loader recovery control, background page or failed boot prevents automatic focus. Hidden, disabled, inert and closed-disclosure controls cannot be selected; later frames and focus returns do not retry the handoff. Existing lobby, pause, Back and Resume behavior is preserved. [Scoped desktop keyboard evidence](verification/cross-mode/p03-e/README.md) records fresh Start focus, explicit play, Escape to Resume and Change setup focus. Preload/error/background cases remain host-test evidence; physical controller/touch and integrated qualification are still open.

## P03-F modal Tab-boundary candidate

The active modal keeps Tab inside its visible eligible first/last boundary in both directions. Interior movement stays with native controls, including file inputs and reading regions; negative tab indices, hidden controls and inactive nested parents are excluded. This change does not activate controls, commit drafts or resume play. Source-host tests cover actual story controls and nested Collection/picture return. [Scoped native evidence](verification/cross-mode/p03-f/README.md) now covers both boundaries in Collection, picture and story, unchanged interior controls and nested Escape returns. Root's earlier BODY-focus failure remains retained separately. Integrated release and physical-device qualification are still open.

## P03-G unfinished-mission replacement candidate

The four interactive Solo entry points—mission card, Level, Campaign and Pack selection (including chapter cards)—ask before replacing a started running/recovering flight, including paused and restored attempts. Selecting the same live mission/campaign/chapter is a no-op. The current selectors stay on the actual flight while one Stay/Replace prompt owns input; repeated changes do not queue more prompts. A ready or terminal attempt keeps its direct selection behavior. Programmatic restore, replay and Library adoption retain their existing contracts.

The prompt pauses and holds autosave before reusing P03-C's checked replay, writer, backup-lock and bounded readback protections. Stay, Escape and controller Back preserve the queued turn and return to the actual opener without Resume. Replace remains disabled while checking. An unverified save warns that replacement may lose this attempt; a changed saved slot requires another deliberate Replace and is not overwritten. Pack download/install preserves the old run and recorder until the final guarded selection; cancelling or failing that preparation does not reset the flight. Pack metadata may already have committed before a later check fails, so this is not a rollback promise.

The [G source and native record](verification/cross-mode/p03-g/README.md) separates 101/101 tests on each Node runtime from root’s desktop keyboard journeys. The confirmation currently leaves excessive blank space at full height; P05 should fit this prompt to its content. G is an internal P03 candidate, not public or physical-device acceptance. At the G boundary, Starting class and Steering still called `prepare()` on live attempts; H below addresses that separate starting-setup path. Settings must not silently convert a live run; starting equipment belongs to a fresh attempt, while the authored Tactical Hangar remains an in-flight action. G does not change those paths, Library scenario launches, Team Change setup or the broader mode-entry design.

## P03-H starting-setup candidate

Starting class and Steering now share G's single confirmation owner. A changed setup for an unfinished ordinary flight restores the displayed current value and asks Stay / Prepare fresh attempt; it never changes live replay identity. Same values do nothing, and ready/terminal attempts retain direct preparation. Preferences are applied only after deliberate confirmation. G mission replacement, H setup and Team departure cannot own concurrent prompts; the ticket also captures starting class, policy, scenario/roster and lesson identity.

Ordinary attempts reuse the checked retention/readback and changed-slot reconfirmation already described for G. Stay preserves the queued turn and explicit Resume boundary. The defensive lesson steering handler asks Prepare fresh lesson without saving campaign progress or the suspended flight; First Flight class stays fixed. Current course menus do not expose Immediate/Grid: the selector lives in the inaccessible course Missions deck. The supported course entry carries the selected policy in its URL; the in-course handler is host coverage only. Practice starting setup uses the same explicit session-only loss warning. Authored Tactical Hangar actions still change the active craft through their existing safe core command, independently of starting setup.

This is internal P03 source work: eight complete files passed 132/132 on Node 22 and 132/132 on Node 20, including 26 new starting-setup host cases. [Scoped native evidence](verification/cross-mode/p03-h/README.md) covers ordinary class/steering Stay and Prepare, exact focus, saved-flight restore and real course return. It used the separately reviewed P05 compact CSS overlay; that stylesheet is not part of H. Integrated release and physical-device qualification remain pending. This does not accept the overall phase. Course selection/Skip/Retry, Library scenario launch and Team Change setup remain distinct departure journeys. No core, replay schema, saved format, content, audio or producer change is included.

## P03-I Team departure candidate

The isolated [Team departure work](team-departure.md) adds an explicit Stay /
discard choice before Change setup, Retry or either same-tab header departure
can replace an unfinished Team attempt. Team progress remains in this page only;
this does not add a saved Team format. Stay preserves the normal paused-input
boundary, and terminal/no-attempt actions retain their direct paths. Native
dialog Escape is handled locally so the existing flight listener cannot prevent
the dialog's cancellation. Four complete affected test files pass 152/152 on each
Node runtime; the [scoped desktop native record](verification/cross-mode/p03-i/README.md)
checks Stay, Retry, setup, 50px actions and header pointer requests with keyboard
confirmation. Paused header keyboard access remains a documented gap requiring
in-panel destination actions. This is an internal P03 work package, not phase or
release acceptance. The isolated branch starts at P03-G and does not include the
separate P03-H starting-setup implementation.

## Player flow and feedback contract

- Title offers Single player, Couch Versus (separate-board race) and Couch Team (shared arena). Solo starts/continues in one activation. Ready Couch players choose a mode and Start from one integrated lobby. Future online/Deathmatch remain deferred, without nonfunctional menu choices.
- Campaign browsing combines installed and downloadable compatible content. Show every mission without medal locks; six desktop cards, two tablet columns, one narrow-phone column. Browsing/downloading does not replace an unfinished Solo save. Starting a different unfinished mission explains replacement.
- Return to the actual opener and restore focus. Returning never implicitly resumes. Preserve explicit Resume, opaque pause, controller ownership, release/neutral-input gates, reconnect and independent Solo progress.
- Default Versus is one race; optional first-to-two counts wins, not draws. An in-memory tour awards one point per mission win; rematch replaces its earlier result. Next prepares before discarding results. Name the successor mission/campaign or completion destination. Team progression stays in memory.
- Every asynchronous action acknowledges immediately, before its first await or long work. Use operation identity, truthful phases, measured progress only where available, retry/cancel and stale-completion protection. A long task may say “Still preparing”; elapsed time alone is not failure. Keep Sound/Back reachable where safe; atomic final saves say “Finishing save”.
- One master mute authority governs Web Audio and HTML audio/video, including Studio and stories. Mute is distinct from transport pause and lifecycle suspension. Retain volume, position and explicit pause; late promises cannot unmute. Use truthful On/Off/Enabling/Blocked states and gesture-safe retry. Do not steal the existing M movement binding.
- Standard/Large and Theme/Plain fonts remain. Controls have at least 44 CSS pixels; prefer 48. Touch controls stay outside playable cells. Reduce decoration/reflow before reducing readability. Motion is interruptible; reduced effects preserve all gameplay cues.

## Presentation, Studio and artwork contract

Keep Phaser, navigation infrastructure and deterministic simulations. Presentation does not change collision, campaign identity or score authority. Evolve the existing registry with versioned `PresentationTheme`, `AssetSlotSpec`, `AssetRevision`, `AssetCollection` and `ThemeBundle`; retain historical readers and immutable records. Resolve shared defaults → theme → collection → local draft. Draft storage must not write player saves or the media database.

Each slot specifies stable identity, type, modes/screens/elements/states, preview, purpose, geometry/dimensions, palette, alpha, density, bounds, pivot/rotors, animation/recipe, bytes, accessibility, provenance, history, dependencies and generated variation/edit/collection prompts. Cover fonts, sounds, images, icons and procedural/component recipes. Required incomplete collections cannot publish.

Studio must show native/enlarged/transparent/animated and real-screen Solo, left/right Versus and Team previews, current/draft comparison and all affected screens. Support uploads, token/palette/crop/scale/pivot/rotor/frame editing, immutable revisions, atomic collection replacement, reset/undo and bounded `.rltheme` import/export with provenance and exact bytes. The single-layer editor (≤128×128) supports pencil, eraser, fill, eyedropper, line/rectangle, selection/move, flip/rotate, palette replacement, grid, undo/redo. Large painting and multilayer animation remain external. Browser uploads only become public through the release workflow.

Production sizes: terrain/HUD glyphs 16²; actions 24²; rewards 32²; compact actors 32²; detailed actors/bosses 64²; nine-slice frames 24²; title 960×540 plus portrait; 4:3 reveal 768×576; 2:1 reveal 1152×576. Keep originals and validate derivatives. Preserve procedural rotors and test at actual play size. Original pixels, silhouettes, contrast and consistent role cues take priority over decorative glow.

Shared binding resolves **exact content identity/revision, edition, collection and artwork revision**, never only level name/ID. Preserve pinned saved/earned and authenticated installed originals. Fresh compatible Solo and Versus attempts use the same approved release-art resolver. Mission preview, progressive reveal, results and Retry retain the prepared binding. Image fitting is separate from board sizing: no stretching/cropping gameplay. Required art failures offer visible recovery; approved training/legacy/import procedural scenes are explicit registered art, not silent substitutes.

Team extends its read-only painter with `setPresentation(snapshot)` and prepared map art, sharing drawing primitives without adapting Team state into Solo simulation. First Connection and Relay Yard keep their 72×36 boards/mechanics and receive original 1152×576 orchard/field and industrial/radio-yard pictures. Each edition provides both arena variants; they are not extra missions. Decorative structures cannot imply collision. Old strict Team level formats receive no extra fields; new custom art uses a versioned presentation envelope. Old imports receive approved generic theme art; invalid required custom art fails visibly.

Team slots cover both numbered/shape-coded players (normal/cutting/downed/crawling/rescuing/recovery), hunter warning/charge/recovery, distinct drifter, available/captured anchors, shielded/exposed/secured cores, emitter warning/travelling spark, Support pulse/slow, rescue progress, joint capture and team recovery. Colour alone cannot identify a player. Support must not look like Scan; anchors must not look like ordinary pickups.

Typography: local Handjet 600, square ELSH=2/ELGR=1, static display ≥40px; Exo 2 UI 18/16/14px, weights 400–600; IBM Plex Mono 500 telemetry. Validate actual shipped WOFF2 English/Ukrainian glyphs including Ґґ Єє Іі Її, apostrophes and realistic strings at 200% zoom. Keep real translation-ready text outside images; full Ukrainian translation is deferred.

Default FPV Ukrainian blue/yellow: ink `#071527`, panels `#10243E`, text `#F6F3E8`, muted `#A8B8CC`, focus `#67AAFF`, player/cut `#FFD64A`, decorative blue `#0057B7`, shaped danger `#FF7169`. Optional red/black textile collection keeps readable functional cues. Ornaments are Off/Subtle/Rich menu decoration, away from critical text/play. Partner identity is an independent compatible collection, not indiscriminate logo recolouring. DroneAid uses its researched brand assets, optimized animation plus still/reduced-motion poster and legible contrast; the 150-frame original must not become an unbounded raw atlas.

## Map-consistency gate (P08-A)

1. Same compatible Solo/Versus mission/edition resolves identical approved fresh art; pinned originals survive.
2. Inspect both Team arenas initially, partially and fully revealed: anchors, core/shield, hunters, Support, downed/rescue/recovery.
3. Verify decoded image bindings and loaded asset revisions, not only similar colours.
4. Exercise imported coverage/multi-stronghold maps, approved generic art, invalid custom art, stale preparation and cancellation.
5. Distinguish both players without colour; warnings work over light/dark art.
6. Whole board, critical HUD and two sets of controls remain usable together; canvas boxes match 4:3/2:1 geometry.
7. Keyboard-only, touch-only and supported controller-only navigation, rotation/reconnect/neutral gates, explicit pause/resume and Retry.
8. ≥44px touch targets, Large/Plain text, reduced motion and zoom.
9. Historical results remain identical for two arenas × three difficulties × three teamwork policies.
10. Deployed Team prepares and plays offline, with required assets and no Solo-save/progress writes.

Inventory covers all 15 static Versus maps (twelve First Signal × four themes plus three fixed-FPV Pressure Lines = 51 combinations), every published/installable Versus entry, two starter Team arenas, imported coverage/multi-stronghold maps and every later edition/campaign automatically. An image absent from pack JSON may be an authenticated external original; classify by its full resolution path.

## Encounters and campaign production boundaries

Retain 132 new Solo missions: four twelve-mission FPV campaigns, four twelve-mission DroneAid campaigns, Living Atlas twelve, After School Arcade twelve and Spend in Motion twelve. Each campaign receives its own version/deployment. Its first edition includes complete shared branding and compatible Solo/Versus/Team presentation. Team's two encounter variants are additional, separately counted. Do not claim all Solo missions support Team automatically.

Gentle/Standard/Hard, optional encounters, labelled combat, reduced effects, mechanical alternatives and optional remains remain required. Cosmetic choices never alter physics. Preserve clean original art; remains are optional attempt/result/earned overlays. No new attack button, homing projectiles, online or Deathmatch.

Auxiliary patrol/carrier/shooter roles use explicit field/safe/both domains and do not seed capture. Contact and exact newly captured cells defeat once. Keep deterministic seeds, checkpoints/replays, lethal-event ordering and bounded rewards. Limits: twelve auxiliaries/twenty-four actors; three shooters; two reserved-or-active projectiles. Fixed aim telegraphs: 1.2s Gentle, 0.9s Standard/Hard; cooldown 12–16/8–12/6–10s; projectile 2 cells/s, 3s TTL, blocked by walls. Stable ready arbitration, clear defeated owners' shots and newly captured shots, stun cancels aim, freeze holds clocks. No posthumous fire or duplicate reward. First three missions introduce no shooter; at most two shooter missions per twelve. Introduce one unfamiliar role at a time.

Team Support preserves its six-cell pulse and 1.5s slow, cancels aim/intercepts projectiles without a free defeat, and retains existing rescue/grace/stronghold semantics. Fair target allocation and shared capture count each actor once. No Solo awards/resources from Team. Qualify 792 Solo difficulty/encounter configurations, explicitly selected Versus cases, and the separate 36-case Team encounter matrix. These are targets, not completed tests.

Xposed's 64 supplied screenshots include 48 numbered references. Reimagine their layout/feedback using original art; screenshots do not prove undocumented mechanics. Human runners, shooting or persistent remains are original proposed mechanics, not claimed observed Xposed behavior. DroneAid Support/Combat, Ukrainian culture, Retro and spend management need distinct readable role semantics. Social Drone UA/Victory Drones receive tested guide/templates here; additional full production is future work.

## Compatibility and capacity

Keep presentation outside simulation/campaign hashes. Allocate the next unused schema versions only after inspecting current dispatch; never mutate historical validators, checkpoints or proof fixtures. Preserve historical Team's strict level imports, independent Solo progress and no persistent co-op saves. Starting-safe regions/new encounter fields require explicit new-version validation and unchanged legacy outcomes.

Retain current budgets unless a separately reviewed requirement explicitly changes them: core offline 64 MiB; main Pages 950 MB; archive 800 MB; media 256 MiB; twelve installed packs, 24 MiB each/48 MiB aggregate; library 4 MiB/512 contexts; save 2 MiB. Theme manifest 4 MiB, bundle 32 MiB, asset 4 MiB, 512 slots, 2,048 revisions, 1,024 themes, 128 collections, image side 1,920/pixels 2,073,600. Plan context/recovery capacity before producing all campaigns. A proposed budget is not permission to bypass a validator.

## Release and evidence protocol

For every row: **implement → review → test → fix → retest → stage related hunks → synchronize version → commit → qualify exact source → freeze → deploy → verify public play → accept**. Use the next unused minor for a phase/campaign and patch for a smaller correction. Synchronize package, lockfile root/top-level and build-config. Inspect staged bytes; never stage unrelated preserved drafts. Update relevant docs, skills and copyable prompts in the same feature.

Six mandatory source gates:

```text
npm test
npm run lint
npm run format:check
npm run format:native:check
npm run validate
node --check authoring/motion-lab/app.js
```

Also require applicable production reproduction/readiness, ordinary build, artifact integrity, relevant browser journeys and public/offline checks. Record exact source identity before/after. Hosted test shards must cover the same full npm test set; partial/focused tests do not replace it. A merge or later source change needs its own qualification.

Use the existing [Pages release procedure](../.cursor/skills/deploy-release-pages/SKILL.md), immutable source snapshot and main-only publisher. Keep game source SHA distinct from publication revision. Preserve original ZIPs/tags/metadata, all historical routes, complete byte audits and failed-attempt evidence. A queued run or artifact is not deployment. Public version/source identity, every deployed manifest body and actual play must agree before acceptance.

Each phase receipt records phase, version, source SHA/tree, publishing SHA, immutable test URL, source/artifact checks, asset hashes/bytes, browser/input/viewports, failures/corrections and public/offline evidence. Keep **inventory, modeled input, actual browser interaction, visual inspection and physical hardware** as separate evidence categories. Never infer physical-device success from responsive screenshots. Required unavailable checks remain outstanding.

Deferred: online multiplayer, Deathmatch, full Ukrainian translation, hosted administration, persistent co-op saves and unlisted community campaign production.
