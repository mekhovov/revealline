# Reveal Line: whole-game UX and production execution

Updated 17 September 2026. This is the current implementation order approved by the user. It replaces the previous ordering; historical release records remain unchanged. Source inspection began at `a53d646153fc9dfb2d8f152fdc9dbde607782777` (accepted Recovery v0.60.4). The isolated `codex/global-settings` branch preserves the unrelated dirty working tree. Settings has now been rebased onto reviewed Motion/uploader ancestry; this is source composition, not release acceptance.

## Accepted work and current feature

P00 and P01 are accepted. P02-A shared master sound is accepted within its recorded scope. P03/P05 have accepted slices through v0.60.4, but neither whole phase is complete. Asset registries, shared fonts, appearance preferences and some Team artwork adapters already exist; this does not establish complete themes, full map parity or production readiness.

**Current feature: shared Settings and quick sound (P03/P05).** Solo, Versus and Team use Controls, Audio, Appearance & accessibility and Game data. Appearance is the initial category; reopening remembers the category for that page visit. Preferences retain their existing owners, records and storage-failure behavior. Team Settings is a native dialog with its actual opener restored. Closing it cannot resume a run. Quick Sound appears on Home, the Versus lobby/pause menu and the Team shell; the Solo Workshop shortcut is labelled Sound rather than Music. Cached pages reconcile saved menu/audio preferences without discarding failed-save intent or starting playback. Settings fields also repaint from current owners after browser form-state restoration; modeled history checks preserve paused attempts, focus and storage. Fresh qualification of the integrated source remains required.

**Integration and publication status.** Motion v0.60.5 source `a336f18306a425f6575b77a3017056d32155043f` is qualified and frozen; source PR #93 merged as `3f94acc62cf6d85fd7c930616747e524e06f8d63`. Its publication remains pending uploader recovery. Settings source `a506b0606224c771353eb6f6160cf3a42dea662b` composes onto reviewed uploader utility `e4129b46e5d9e66563fb01b324b8855660298715` (PR #95), a descendant of that Motion merge. The utility is reviewed but not yet accepted on main. Neither this rebase nor Motion's frozen source establishes public acceptance of Settings or completion of P03/P05.

**Previous required CI.** Settings source `2330e5e64ce4899aab6ccc1f15ced78bf3ea9655` completed [PR qualification](https://github.com/mekhovov/revealline/actions/runs/35252455053) and [manual qualification](https://github.com/mekhovov/revealline/actions/runs/35252465261), both on Node 20.19.6. Each run records **5,573 tests: 5,569 passed and four known stale navigation-test failures**, zero skipped or cancelled. Predecessor `c3fb3296085656d61b3a296e2f37c1520fd322e0` corrected those expectations; the fixes are retained in rebased source `a506b060`. The failed runs remain historical evidence, and fresh exact-source gates on the integrated result are required before freeze, release and public verification.

The interface colour/ornament preference is **not** a complete game theme. The complete visual-theme catalogue, exact collection pins and alternate pictures remain in order 7. Game data in Couch Settings truthfully describes page-local attempts; unified content administration remains in order 6. No new campaign, encounter, Team music or complete phase acceptance is claimed by this feature.

## Required order and blocking completion

| Order | Phase / feature | Completion requirement | Current status |
| --- | --- | --- | --- |
| 1 | Baseline reconciliation | Preserve working tree/history, integrate reviewed work and finish already qualifying releases. | v0.60.4 accepted; Motion frozen, publication pending; reviewed uploader ancestry composed. |
| 2 | P03/P05 Settings and sound | Shared categories, quick mute, immediate global appearance, safe pause/return and storage reconciliation. | Source composed; fresh integrated gates and public acceptance pending. |
| 3 | P03/P05 navigation | Shared Home/lobbies/Pause/Help/Workshop; actual opener restoration, responsive focus order and device prompts. | Partial. Missions Back must restore Missions, not Continue. |
| 4 | P07-A/P16-A continuation and data safeguards | Stage Next before retiring results, explicitly retain Retry artwork, offer difficulty change, accurate backup scope and replacement preflight. | Pending. |
| 5 | P08-A existing maps | Both Team arenas, all 15 built-in Versus maps, installed/imported paths, reviewed art and complete required roles; full board/control clearance. | Reviewed candidates retained; not fully accepted. |
| 6 | P06/P07-B catalogue and journey | One community → campaign → missions browser; discovery/download/play, teasers/full preview, specific offline dependencies and useful campaign endings. | Pending. |
| 7 | P04/P05 Studio and complete themes | Upload/edit/history/export/import, exact retained themes, real Solo/two-board Versus/Team previews and two-collection benchmark. | Partial tools; benchmark pending. |
| 8 | P08-B/P02-B feedback and audio | Qualified countdown/loss/capture/rescue/results, reduced effects, soundtrack parity and listening. | Partial; independent features release separately. |
| 9 | P09 encounters and difficulty | Deterministic optional encounters, readable counterplay, Gentle/Standard/Hard, checkpoints/replays and human fairness review. | Pending benchmark before production. |
| 10 | P10 Team encounters | 36 configurations preserve Support, rescue, strongholds and two-player readability. | Pending. |
| 11 | P11-A–D FPV | First Contact, Crossing Lines, Signal Pressure, Last Relay: twelve reviewed missions each. | Pending; independent campaign releases. |
| 12 | P12-A–D DroneAid | Community Connections, Supply Corridors, Contested Signal, Return Signal: twelve each; approved branding, animation, Support/Combat presentation. | Pending; independent campaign releases. |
| 13 | P13–P15 editions | Living Atlas, After School Arcade, Spend in Motion: twelve complete missions each. | Pending. |
| 14 | P16/P17 remaining workflows and guide | Collection, learning, replay, legacy curation, public links; independently reproduce community creation, installation, play and recovery. | Partial; full closure pending. |
| 15 | P18 qualification | Close all required accessibility, compatibility, content, offline, performance and public-play gaps. | Pending. |

## Product and compatibility contracts

- Home → Start/Continue or Campaigns → Play → Results → Next/Retry. Preparation is optional. Keep help directly reachable from preparation and Pause. Put software history in About/build information, not a competing “edition” choice.
- Settings opens inside its current host, pauses/releases input and restores the opener. Resume is explicit. Interface appearance is global and immediate; settings never replace a live attempt.
- Catalogue availability distinguishes Ready, Download required, Preparing, Locked with reason, Unsupported mode and Needs repair. One Play or Download & play action; retain selection. Previewing never earns a picture or completion.
- Next names/prepares its destination while the old results remain usable, then starts with no second Ready action. Retry retains accepted picture and collection. Explicit difficulty change makes a fresh simulation with retained visuals. Difficulty never changes secretly.
- End-of-campaign results include rewards and Next campaign/Browse campaigns, Retry and View picture. Separate View earned original, Replay recorded flight and Play mission again. Mission access remains shared across difficulties; records remain difficulty-specific.
- Complete themes default to Use campaign style. Fixed themes require a complete reviewed compatible collection. Unsupported content offers Play with campaign style; broken required assets offer recovery. Never silently mix required visuals.
- Keep authored content/simulation identity separate from cosmetic theme choice. Retained attempts resolve exact revisions. Preserve existing global preference storage protections, old readers, pinned original ownership, presentation dependencies in backup/recovery/offline data and stale-preparation safeguards.
- Qualify First Signal, First Connection and Relay Yard with FPV and an original Ukrainian ornamental collection with genuinely different approved visuals and pictures before expanding theme availability. Studio must show genuine cross-mode contexts, provenance, dependencies, immutable history and copyable generation/edit prompts.
- Acknowledge asynchronous actions immediately; announce status without stealing focus. Use measured progress only. Distinguish Stop waiting from cancellation. Offline readiness covers selected artwork, presentation and advertised audio, with repair actions.
- Keep short motion cues and visible telegraphs. Simulation starts only at the specified gameplay start. Reduced effects preserves warning meaning and timing. Do not infer animation timing or enemy mechanics from screenshots alone.

## Production boundaries

Retain **132 new missions, 792 Solo difficulty/encounter configurations and 36 Team configurations**. Each mission needs an objective, introduced skill, threat/counterplay, difficulty variants, reviewed artwork, rewards and playtest findings. Twelve-mission campaigns progress through introduction, combination, pressure, remix and a final challenge; different backgrounds alone do not establish variety.

Encounters remain optional with clearly labelled combat, mechanical alternatives, reduced effects and optional remains overlays. Preserve clean original pictures. The benchmark precedes bulk content. Do not add new attack families, homing projectiles, online play or Deathmatch in these phases. Full Ukrainian translation, hosted administration and persistent co-op saves remain deferred.

## Journey and release gates

For each feature: implement → independent review → test → fix → retest → stage related hunks → synchronize package/lock/build version → commit → qualify exact source → freeze → deploy → verify public play. Use the next unused patch for a smaller feature and minor for a completed phase. Existing frozen bytes and tags remain immutable.

Run all six source gates (`npm test`, lint, format, native format, validate and Motion Lab syntax), production reproduction/readiness, build/artifact checks and relevant browser checks. Record phase, version, source SHA, publishing revision, immutable URL, actual bytes and evidence limits. Required failures block acceptance and advancement; a published defect receives a new patch.

Required full journeys:

- Fresh player → first capture → loss → Retry → win → Next → campaign ending.
- Saved Continue → Settings → mode switch/cancel → exact restoration.
- Download & play → cancellation/failure → retry → offline relaunch.
- Collection → picture/story/records → exact return.
- Theme change → fresh attempt → Retry → backup → restore after update.
- Both Couch players → disconnect/rotation/pause → explicit recovery.
- Backup replacement with and without Undo; catalogue/help/Workshop link closure in the published build.

Keep native keyboard, modeled controller, physical controller, touch hardware and viewport emulation distinct. Include desktop/tablet, 1280×800 handheld, portrait and short landscape, 44px touch targets, EN/UA shipped glyphs, Plain/Large, meaningful 200% zoom, status announcements and reduced motion. Measure frame time, decoded-image memory, download/storage cost against baseline. Normal play/install/progression cannot depend on a file picker; advanced tools state their input requirements.

## Design references

Use [Xbox navigation guidance](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112) for consistent focus/Back, [direct-start guidance](https://gameaccessibilityguidelines.com/allow-the-game-to-be-started-without-the-need-to-navigate-through-multiple-levels-of-menus/) for minimal compulsory setup, [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) for non-disruptive progress, [Dead Cells accessibility changes](https://deadcells.com/patchnotes/29) for readable outlines/effects, and [Steam handheld guidance](https://partner.steamgames.com/doc/steamhardware/recommendations) for controls/text. These are design references, not certification. Supplied Xposed images remain structural/art-direction evidence; production artwork is original.
