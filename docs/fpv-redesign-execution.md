# FPV redesign execution register

This register records the implementation and source-freeze history. Current publication authority and its final delivery record are linked from [deployment documentation](deployment.md); a qualified source or integration commit alone does not mark a public release complete.

The user approved the complete redesign plan on 2026-09-14. This register tracks implementation and actual delivery, separately from the historical production backlog. Baseline: `fe9961e` (v0.43.0). Working branch: `codex/fpv-redesign-isolated` in the dedicated `go_test_fpv_redesign` checkout. The original checkout remains available to parallel audio/fullscreen tasks.

## Fixed product decisions

- Complete original pixel FPV field-kit presentation; other new theme collections are deferred.
- Handjet square display accents (`ELSH=2`, `ELGR=1`, weight 600), Exo 2 interface text, IBM Plex Mono counters. Full English/Ukrainian glyph coverage; translations follow later.
- Accessible DOM game controls around the existing Phaser presentation and unchanged simulation.
- One versioned asset/theme registry, compiler and local studio, extending existing provenance/history principles without changing old schemas.
- Per-element previews, requirements, generated prompts, revision history, uploads, token/geometry editing and a single-layer <=128×128 sprite editor.
- Original-preserving, atomic `.rltheme` collection exchange. Studio drafts do not alter player saves; published defaults travel through releases.
- Current pause concealment, explicit Resume, input ownership, campaign identities, saved flights and first-earned artwork remain authoritative.
- Stage only related lines/hunks; bump package/lock/build versions together; immutable release, GitHub push/PR, Pages deployment and public verification for every completed phase/feature.

## Phase status

| Phase | Deliverable                                                                               | State                                                      | Release/evidence                                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Baseline, reference/design atlas, font specimens, screen/state inventory                  | Qualified, frozen and released; canonical archive verified | v0.44.0 / fc789c71; all six gates, 3,433 tests; 700-file archive audit and public saved-flight/play/Collection/offline checks passed       |
| 1     | Fonts, semantic tokens and shared components throughout the game                          | Qualified, frozen and released; canonical archive verified | v0.45.0 / adacdfbe; all six gates, 3,433 tests and public play/save/Collection/offline checks passed                                       |
| 2     | Asset registry, theme resolution, compatibility adapters and compiler                     | Qualified, frozen and released; canonical archive verified | v0.46.0 / 0b0d2d79; all six gates, 3,463 tests and public play/save/Collection/offline checks passed                                       |
| 3     | Local asset studio, sprite editor, previews, prompts and bundle exchange                  | Implemented source; release pending                        | v0.47.0 candidate; edit/validation/undo/save/reload/restore/export UI checked                                                              |
| 4     | Original title scene and illustrated mission/briefing navigation                          | Implemented source                                         | v0.48.0 candidate; exact landscape/portrait scenes, five-action title and responsive gallery                                               |
| 5     | Complete current FPV flight art, HUD, controls and feedback                               | Implemented; qualification in progress                     | v0.49.0 candidate; 30 native sprites, 45 glyphs, 44 reveal frames for 56 owners, title v2 and compiled runtime                             |
| 6     | Collection, settings/data, learning, couch, replay, workshops and supporting screens      | Implemented; qualification in progress                     | v0.50.0 candidate; categorized settings, Collection/records, complete Workshop navigation and shared release/archive pages                 |
| 7     | Full coverage, compatibility, accessibility, performance/offline and public qualification | Working source; release qualification pending              | v0.51.0 candidate; native 200%/responsive fixes, exact-owner previews, Signal 06 v2, artwork-led results, role-aware specimens and prompts |

## Acceptance and release protocol

All required FPV screen/component/asset slots must resolve to working assets or registered procedural recipes with previews, specifications, provenance and prompts. No placeholder counts as finished artwork. New pictures use new immutable presentation revisions; saved and earned originals retain their pins.

Verify registry/import bounds, image decode/geometry, stale edits, immutable history, atomic collection replacement, undo and byte-preserving bundle round trips. Inspect real English/Ukrainian text, Standard/Large and 200% zoom; desktop/tablet/portrait/short-landscape layouts; keyboard, touch layout and modeled controller paths. Exercise first cut, continued flight, pause/retry, victory/Collection, saved continuation and offline cold start. Distinguish physical-device evidence from desktop emulation.

For each release, record the exact committed SHA, six source gates (validation, lint, tests, format, native format, motion-lab syntax), frozen build/manifest, actual browser observations, PR, deployment run and public URL. Keep existing 950 MB main/800 MB archive hosting budgets and storage limits. Public delivery is incomplete until deployed bytes and real play pass. Do not rewrite old tags, artifacts or failed evidence.

Update authoring skills and prompt examples in the same feature boundary as the implemented interface. Recheck current Git state and remote main before each release because other work may advance independently. Supplied Xposed/drone research and unrelated generated concepts remain preserved source references, outside player downloads.

Pre-release qualification found six outdated baseline test expectations (controller neutral auto-join and the nullable touch-layout preference). The candidate repairs those fixtures without changing controller routing or saved metadata. The failed source and receipt remain available in the local qualification evidence; all six gates must pass on the revised exact source before freezing.

Candidate source qualification also runs on pushes to the phase branches through `qualify-release-source.yml`. It records the actual commit/tree and Node version, runs the same six gates and reproduces the production collection. This job does not publish or deploy; Pages continues through its existing workflow after release preparation and integration. Phase 7 retains the same complete test discovery but runs it through the reviewed deterministic sharder in four isolated CI jobs. Every job records the exact commit/tree and runner, and each test shard records its file list. The release receipt must verify their disjoint union and actual test results; it must not claim a monolithic npm test command ran.

Archive 08 reserves v0.47.0/v0.48.0 before the v0.49.0 public cutover. Its allocation must be available in the Pages controller independently of the frozen game source; never mutate a frozen game to update hosting locations. Actual archive creation, every-file public verification and canonical URL handoff remain required before using that allocation.

## Final qualification corrections

Phase 7 records native English/Ukrainian font checks, 200% browser zoom, exact-owner previews for all 44 prepared exports and metadata integrity for 56 picture owners, corrected primary/danger/tab specimens, and per-slot asset review evidence. Signal 06 v2 removes sky stippling while retaining its original/derivative history. Results now show this completed attempt's image before its details; saved/earned pins and explicit legacy originals remain authoritative. Resume replaces its stale paused instruction after the run resumes.

Cold-source measurements found the first title frame still requested the 866 KB v1 illustration before the compiled v2 replacement. Boot, flow and compiled fallbacks now reference the existing 26 KB v2 asset. This changes the startup presentation without dropping historical v1 originals. Draw-cost measurements and final payload figures are recorded separately from public compressed transfer and physical devices.

Archive 09 reserves v0.49 / v0.50; dedicated Archive 10 retains the concurrent v0.42 release. A Pages publishing controller can omit its current version from a shard plan while serving those frozen bytes at the main root/version path. It can archive already-tagged later editions once their public copies pass verification. Keep the full allocation registry, per-publication overlay, exact frozen game identity and public byte receipts separate; do not change a frozen source or raise the 950/800 MB budgets to repair hosting capacity.

The final production collection is revision 13: 194 reviewed required slots, 99 optional historical source slots and no required gaps. Every review is retained as an immutable revision with its scoped evidence. Release-source qualification now checks committed review declarations after reproducible production, separately from visual acceptance. The final source also preserves the independently merged release automation at `ca03742` through integration `fade9ca`; its simulation files are unchanged by that merge.

The combined actor library and redesign keep the existing 64 MiB offline-core ceiling by declaring `fpv-arcade-r5.json` optional, alongside earlier Arcade editions and Pressure Frontier. Its original bytes remain in the loose distribution, ZIP and manifest. The existing game-data message names optional chapters and instructs installation while online; installed packs stay in device storage for offline play. Base missions and normal saved-flight storage are unchanged. The built cache and an installed Arcade R5 offline journey require explicit release verification.

The approved disabled Pages controller was integrated at `6ef663b`, retaining the new release-event routing and separate main-only publisher. Its disabled fixture cannot deploy; the final selector receives qualified source and archive receipts only after they exist. Production game bytes remain independent of publication metadata.
