# FPV redesign execution register

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

| Phase | Deliverable                                                                               | State                                   | Release/evidence                                                                             |
| ----- | ----------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| 0     | Baseline, reference/design atlas, font specimens, screen/state inventory                  | Qualified and frozen; publication pending        | v0.44.0 / fc789c71; all six gates, 3,433 tests and 357 frozen bodies verified                                         |
| 1     | Fonts, semantic tokens and shared components throughout the game                          | Implemented; release qualification next | v0.45.0 candidate; 60 focused tests and source phone checks passed                           |
| 2     | Asset registry, theme resolution, compatibility adapters and compiler                     | Implemented source; release pending     | v0.46.0 candidate; 293 slots, exact current-art adapter, compiler and strict transfers       |
| 3     | Local asset studio, sprite editor, previews, prompts and bundle exchange                  | Implemented source; release pending     | v0.47.0 candidate; edit/validation/undo/save/reload/restore/export UI checked                |
| 4     | Original title scene and illustrated mission/briefing navigation                          | Implemented source                      | v0.48.0 candidate; exact landscape/portrait scenes, five-action title and responsive gallery |
| 5 | Complete current FPV flight art, HUD, controls and feedback | Implemented; qualification in progress | v0.49.0 candidate; 30 native sprites, 45 glyphs, 44 reveal frames for 56 owners, title v2 and compiled runtime |
| 6     | Collection, settings/data, learning, couch, replay, workshops and supporting screens      | Planned                                 | —                                                                                            |
| 7     | Full coverage, compatibility, accessibility, performance/offline and public qualification | Planned                                 | —                                                                                            |

## Acceptance and release protocol

All required FPV screen/component/asset slots must resolve to working assets or registered procedural recipes with previews, specifications, provenance and prompts. No placeholder counts as finished artwork. New pictures use new immutable presentation revisions; saved and earned originals retain their pins.

Verify registry/import bounds, image decode/geometry, stale edits, immutable history, atomic collection replacement, undo and byte-preserving bundle round trips. Inspect real English/Ukrainian text, Standard/Large and 200% zoom; desktop/tablet/portrait/short-landscape layouts; keyboard, touch layout and modeled controller paths. Exercise first cut, continued flight, pause/retry, victory/Collection, saved continuation and offline cold start. Distinguish physical-device evidence from desktop emulation.

For each release, record the exact committed SHA, six source gates (validation, lint, tests, format, native format, motion-lab syntax), frozen build/manifest, actual browser observations, PR, deployment run and public URL. Keep existing 950 MB main/800 MB archive hosting budgets and storage limits. Public delivery is incomplete until deployed bytes and real play pass. Do not rewrite old tags, artifacts or failed evidence.

Update authoring skills and prompt examples in the same feature boundary as the implemented interface. Recheck current Git state and remote main before each release because other work may advance independently. Supplied Xposed/drone research and unrelated generated concepts remain preserved source references, outside player downloads.

Pre-release qualification found six outdated baseline test expectations (controller neutral auto-join and the nullable touch-layout preference). The candidate repairs those fixtures without changing controller routing or saved metadata. The failed source and receipt remain available in the local qualification evidence; all six gates must pass on the revised exact source before freezing.

Candidate source qualification also runs on pushes to the phase branches through `qualify-release-source.yml`. It records the actual commit/tree and Node version, runs the same six gates and reproduces the production collection. This job does not publish or deploy; Pages continues through its existing workflow after release preparation and integration. Full tests use the same bounded file concurrency now adopted by the parallel main-branch work.
