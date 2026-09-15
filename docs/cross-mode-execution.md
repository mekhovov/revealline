# Reveal Line cross-mode execution register

Approved scope: **consistent maps and presentation across Solo, Versus and Team**, followed by complete edition production. This register implements the user's revised P00–P18 plan. It supersedes earlier phase ordering, not historical release evidence or ownership. Updated 15 September 2026.

**Active phase: P01 — loading feedback. Implementation and qualification in progress.** P00 is accepted as immutable v0.55.0, source `acc9f265b651017fd268ffd8bbe6989bec614c41`; its [public acceptance](../publishing/pages-controller/delivery/evidence/cross-mode-p00/public-v055/acceptance.json) records the deployed bytes and ordinary play. The integration worktree includes the subsequently reviewed v0.56.0 source and P00 evidence merge `a395462b101c348d28ee2643c24263ca72b2c751`. P02 cannot start until P01 has its own exact-source qualification, immutable release and public acceptance. A source change, unit test, generated asset or uploaded artifact alone is not a completed phase.

P01's initial v0.57.0 release passed its six source gates, all 4,185 tests and the complete 2,373-file public audit. The public portrait check exposed an active offline label that includes the full optional-pack catalogue and pushes the count/Stop action below the initial viewport. P01 remains unaccepted while v0.57.1 corrects that visibility problem and receives its own qualification. Preserve the original release and failed observations; the [P01 delivery record](../publishing/pages-controller/delivery/evidence/cross-mode-p01/README.md) distinguishes the initial publication from the corrective release.

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

| Phase | Status       | Independently releasable deliverable                                                                               | Blocking acceptance                                                                                                                      |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| P00   | accepted     | Preserve and integrate relevant work; inventory screens, maps, content paths, assets and compatibility.            | Reproducible baseline, preserved historical saves/art/releases, every requirement assigned below; exact-source and public release proof. |
| P01   | implementing | Immediate loading feedback across boot, launch, download, preparation, recovery, media and Studio.                 | Slow/failure/cancel/retry/cached/stale completion journeys preserve state.                                                               |
| P02   | queued       | Shared quick master sound controls across modes, dialogs and media tools.                                          | Every audio path obeys mute, including late promises; transport intent, volume and bindings preserved.                                   |
| P03   | queued       | Single player, Couch Versus and Couch Team entry; integrated lobbies and Back/Resume.                              | Direct Solo Start/Continue, mode-plus-Start Couch entry; keyboard/touch/controller routing and responsive controls.                      |
| P04   | queued       | Five-edition registry, explicit Team slots, cross-mode Studio previews, bindings, editing/history/prompts/bundles. | Real upload/edit/save/export/import, exact byte round trip, invalid/stale/capacity/atomic failure handling.                              |
| P05   | queued       | Shared typography, Ukrainian palettes, ornaments, components and Team shell.                                       | Actual EN/UA glyphs, contrast, Large/Plain text, zoom, focus, reduced motion and affected screens.                                       |
| P06   | queued       | Unified compatible-content catalogue, controlled installation and shared art preparation.                          | Every campaign selectable; correct Download & play; failure/staleness preserves selected content and saved flight.                       |
| P07   | queued       | Direct Retry/Next, clear endings, one-race Versus tours, optional first-to-two and Team order.                     | No duplicate scoring; failed Next retains results; named successors; independent Solo progress.                                          |
| P08-A | queued       | Complete existing map presentation parity, imported Team rendering, Versus art resolution and canvas fit.          | All ten map-consistency gates below. Existing Team maps cannot wait for P10.                                                             |
| P08-B | queued       | Countdown, cut/capture, loss/recovery, Support/rescue, objective/HUD feedback and reduced effects.                 | Readability in motion, unchanged historical outcomes, performance and responsive checks.                                                 |
| P09   | queued       | Versioned auxiliary patrols/carriers/shooters, difficulty, defeat, telegraphs, remains and replay/checkpoints.     | Small deterministic compatibility slice before bulk content.                                                                             |
| P10   | queued       | Encounter variants of First Connection and Relay Yard.                                                             | Separate 36-case Team matrix; Support/rescue/stronghold/two-player readability.                                                          |
| P11-A | queued       | FPV First Contact, twelve missions.                                                                                | Complete first-edition assets and compatible modes; campaign production/playability/progression/public gates.                            |
| P11-B | queued       | FPV Crossing Lines, twelve missions.                                                                               | Same independent campaign gates.                                                                                                         |
| P11-C | queued       | FPV Signal Pressure, twelve missions.                                                                              | Same independent campaign gates.                                                                                                         |
| P11-D | queued       | FPV Last Relay, twelve missions.                                                                                   | Same independent campaign gates.                                                                                                         |
| P12-A | queued       | DroneAid Community Connections, twelve missions.                                                                   | Complete brand/animated logo/poster and mode assets; Support framing and campaign gates.                                                 |
| P12-B | queued       | DroneAid Supply Corridors, twelve missions.                                                                        | Support framing and independent campaign gates.                                                                                          |
| P12-C | queued       | DroneAid Contested Signal, twelve missions.                                                                        | Clearly labelled Combat framing and independent campaign gates.                                                                          |
| P12-D | queued       | DroneAid Return Signal, twelve missions.                                                                           | Clearly labelled Combat framing and independent campaign gates.                                                                          |
| P13   | queued       | Living Atlas, twelve culture/history missions.                                                                     | Complete edition, cultural/art review, variety, applicable modes and release checks.                                                     |
| P14   | queued       | After School Arcade, twelve Retro missions.                                                                        | Complete edition, distinct encounters/art/audio, cross-mode and release checks.                                                          |
| P15   | queued       | Spend in Motion, twelve Coupa missions.                                                                            | Complete edition, clear noncombat semantics, cross-mode and release checks.                                                              |
| P16   | queued       | Collection, settings/data/recovery, learning, replay, workshops, supporting pages and legacy categories.           | Full navigation/state coverage; originals and historical content preserved.                                                              |
| P17   | queued       | Community guide, prompts, templates, compatibility and release workflow.                                           | Independent fresh-workspace example created, installed, played and recovered.                                                            |
| P18   | queued       | Full cross-phase/edition/content/accessibility/performance/offline/public regression.                              | No unresolved required content, slot or acceptance item.                                                                                 |

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
