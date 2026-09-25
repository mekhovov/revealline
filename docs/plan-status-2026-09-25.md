# Reveal Line — current delivery status and remaining plan

Status checked **25 September 2026**. This document supersedes the execution
status in `plan-status-2026-09-23.md`; it does not replace gameplay contracts,
research evidence, release receipts, or the player-feedback register.

Effort ranges are engineering estimates from the moment an item becomes the sole
release candidate. Hosted queues, failed reruns, archive preservation, and human
or physical-device availability can extend them. A prepared branch, reviewed PR,
immutable GitHub release, Pages selection, and public acceptance are separate
states. Skipped suites are never counted as passes.

## 1. Current release state

- **Public Pages selects v0.111.1.** Public Home, the 91-mission New Journey
  gallery, prepared Solo play, Versus play, and the 12-mission Team Journey were
  checked through the ordinary release URLs.
- **v0.111.0 and v0.111.1 are immutable published releases.** v0.111.1 fixes
  Steam Deck/Chrome confirmation echoes and is now the public Pages default.
- **Archive76 now preserves v0.111.0.** Its public deployment passed an exact audit
  of 1,146 files and 595,553,722 bytes with zero failures. Fresh browser checks
  launched the 91-mission Solo and Versus Journeys and the 12-mission Team Journey.
- **PR476 is merged and Pages workflow run 36095346816 passed.** Its exact archive
  preview covered 76 admitted releases with zero observations; focused evidence
  included 63 controller tests and five archive-extraction tests.
- Protected main continues to advance through reviewed maintenance and status
  corrections. Release qualification must therefore fetch and record fresh
  protected-main authority rather than treating a dated commit as permanently
  current. Publication remains serialized through one publisher.

## 2. Completed and publicly delivered

| Area                  | Public result                                                                                                     | Boundary                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Default content       | New Journey is the normal Solo/Versus/Team entry; Classic, installed, Custom, and legacy content remain reachable | v0.83.0 onward                                           |
| Content selection     | Unified owner-aware mission library and direct compatible launches                                                | v0.84.0 onward                                           |
| Difficulty            | Gentle, Standard, and Expert influence authored pressure, speed, counts, and lives                                | v0.86.0 onward; whole-game balance remains open          |
| Progression           | Next crosses campaign, pack, and collection boundaries in all three modes                                         | v0.90.0 onward                                           |
| Movement              | Field actors travel straight between physical impacts; route changes happen at collisions                         | v0.91.0 onward                                           |
| Player input          | Shared keyboard/controller navigation foundations and initial player-first input corrections                      | v0.98.0                                                  |
| Classic compatibility | Compatible Classic missions can launch with current rules while Original editions remain available                | v0.101.0/v0.104.0                                        |
| Main actor            | Corner-bracket visual clutter was removed and the readable FPV craft restored                                     | v0.103.0                                                 |
| Home and Pause        | Compact Home, global More menu, focused Pause hierarchy, and controller menu repairs                              | v0.105.0–v0.108.0; cross-mode consolidation remains open |
| Team presentation     | Original pictures, readable actors, and corrected picture authority                                               | v0.109.0/v0.110.1                                        |
| Release safety        | Immutable releases, protected main, exact-source qualification, archives, and reviewed selector                   | v0.111.1 publicly selected; discipline remains active    |

The Xposed-led programme is not complete. Public releases provide the foundation,
but consistent cross-mode player flows, rewards, gallery behavior, failure/retry,
HUD qualification, theme coverage, campaign production, and final device testing
remain open.

## 3. Prepared work that is not public

| Candidate                      | Current evidence                                                                                                                                                                   | Required before release                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete creator framework     | PR465 is a large, unversioned creator/admin draft, 52 commits behind the reviewed player baseline and without a qualified release head                                             | Preserve it as provenance, then rebuild and qualify it after the player-first releases for v0.123.0 or the next unused post-player slot        |
| Couch quick start              | PR482 is the assigned v0.112.0 player aggregate on current main; PR478 is its superseded component evidence                                                                        | Finish fresh exact-head focused/static/build and independent review, then hosted gates, immutable release and public verification              |
| Character trail/impact cleanup | PR482 contains the canonical PR447/PR403 trail patch plus reviewed craft-silhouette cleanup; PR447 and PR403 must not merge separately                                             | Verify the exact final aggregate preserves the clean craft silhouette, then qualify and release                                                |
| Shared Home/lobbies/Pause      | Clean unversioned candidate covers compact Home, collapsed Couch setup, More/Releases, Sound and shared Pause; reconciliation is active                                            | Reconcile on the accepted release, fix its remaining lifecycle failures, finish keyboard/controller/touch and responsive review, then release  |
| Gameplay HUD/layout            | Clean 15-path candidate; 324/324 responsive/controller/touch checks passed                                                                                                         | Rebase on accepted release source, production build, visual/browser checks, release                                                            |
| Deliberate terminal failure    | Clean 17-path candidate; 51 focused terminal/recovery/Team checks passed                                                                                                           | Rebase, build, browser checks, release; no automatic terminal restart may return                                                               |
| Settings/Help return           | Clean candidate; 30 focused and 102 history checks passed                                                                                                                          | Rebase, cross-mode opener/focus review, release                                                                                                |
| Journey rewards                | Solo and Couch exact-picture candidates exist with focused evidence                                                                                                                | Consolidate mode-scoped completion, exact artwork retention, Collection visibility, migration/history checks, release                          |
| Compact mission gallery        | Earlier UX1-B candidate exists                                                                                                                                                     | Restack after rewards; finish complete-gallery selection, previews, one-action play, lazy resource handling, and responsive spatial navigation |
| Reviewed Team library          | PR475 exposes 12 opt-in specialist candidates                                                                                                                                      | Reconcile dependency stack, clear production-ledger debt, human balance, device checks, and explicit adoption decision                         |
| Appearance/theme surfaces      | Current main already ships global Appearance/Audio settings, FPV palette, ornaments, quick Sound and return ownership. Old PRs add a small resolver plus supporting/admin surfaces | Defer creator/admin parts; release only a visually reviewed core resolver after menus and rewards, then continue full-theme restoration later  |

Candidate tests prove deterministic behavior in the tested scope. They do not prove
physical controller/touch behavior, offline readiness, whole-campaign balance, or
that a level is enjoyable.

## 4. Updated release order and ETA

Release publication remains sequential. Implementation, review, and focused tests
continue in parallel so the next feature is ready when the publisher becomes free.

| Order     | Deliverable                                                                 |   ETA after its release slot opens | Blocking acceptance                                                                                                                           |
| --------- | --------------------------------------------------------------------------- | ---------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **R0**    | Preserve v0.111.0 and make v0.111.1 the public Pages default                |                       **Complete** | PR476 merged; archive exact-byte audit passed; Pages deployed; public marker and ordinary Solo/Versus/Team entry passed                       |
| **R1**    | **v0.112.0** — PR482 Couch quick start plus trail/impact/craft cleanup      |                      **4–8 hours** | One Start with valid defaults, Cancel cannot steal controller Confirm, clean actor silhouette, exact-head hosted gates and public proof       |
| **R2**    | **v0.113.0** — Shared Home, lobbies, Pause, More, Settings, Help, and Sound |                     **8–16 hours** | Same player-facing structure in Solo/Versus/Team; direct Start/Continue; optional setup collapsed; exact opener restoration                   |
| **R3**    | **v0.114.0** — Journey rewards and working Collection                       |                     **8–16 hours** | Mode-scoped completion, exact earned pictures, Retry retention, correct Collection entries and return focus                                   |
| **R4**    | **v0.115.0** — Bounded core appearance resolver                             |                      **4–8 hours** | Use current global settings, avoid UX2/reward overlap, prove visual/accessibility value and exact restoration                                 |
| **R5**    | **v0.116.0** — Reviewed Team specialist library                             |               **1–2 working days** | All 12 entries explicitly reachable, Original editions preserved, picture/Next/Continue correctness, human cooperative review                 |
| **UX1-B** | **v0.117.0** — Compact complete mission gallery                             |               **1–2 working days** | Complete campaign-grouped gallery, current selection restoration, one-action ready/download-and-play, keyboard/D-pad/touch spatial navigation |
| **UX3**   | **v0.118.0** — Gameplay HUD, touch layout, and contextual teaching          |                     **8–16 hours** | Whole boards, critical HUD, and controls fit desktop, handheld, portrait, and short landscape; reduced-effects parity                         |
| **UX4**   | **v0.119.0** — Countdown, deliberate failure/Retry, named continuation      |                     **6–12 hours** | No pre-Go simulation, automatic terminal restart, accidental held-input Retry, duplicate award, or stale successor launch                     |
| **UX5**   | **v0.120.0** — Settings, difficulty, Help, replay and recovery closure      |                     **6–12 hours** | Complete focus/input/loading coverage; ordinary play never needs Workshop or a file picker                                                    |
| **UX6**   | **v0.121.0** — Whole player-experience qualification                        | **2–4 working days** after UX1–UX5 | Required end-to-end journeys pass; physical-device and offline limits recorded separately                                                     |
| **P08-A** | **v0.122.0** — Existing map/presentation parity closure                     |               **1–3 working days** | Built-in Versus, Team, installed and imported paths use complete reviewed artwork and role bindings                                           |
| **Post**  | **v0.123.0 or next unused** — PR465 creator framework                       |               **2–4 working days** | Fresh reconciliation, creator/build/source/provenance gates and separately stated hosted-service limits                                       |

All future version numbers are tentative until each aggregate is rebuilt on the
accepted public source and the next unused version is rechecked.

## 5. Remaining original programme after player-first UX

These items continue after the player-critical sequence unless they can be safely
prepared without delaying it.

| Programme                         | Remaining scope                                                                                                           |                                                               Planning range |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------: |
| P08-A map/presentation parity     | All built-in Versus maps, Team arenas, installed and imported paths, complete objective roles                             |                                                                     1–3 days |
| P04/P05 Studio and themes         | Exact theme restoration, cross-mode previews, uploads/edit/history/export/import, FPV and Ukrainian benchmark collections |                                                                     2–5 days |
| P06/P07 catalogue/offline journey | Campaign-specific downloads, repair/cancel behavior, offline dependencies, endings and continuation                       |                                                                     2–4 days |
| P08-B/P02-B motion/audio          | Countdown, loss, capture, rescue, results, reduced-effects variants, soundtrack parity and listening checks               |                                        1–3 days plus listening/device access |
| P09/P10 encounters/difficulty     | Deterministic optional encounters, Gentle/Standard/Hard fairness, Team encounter matrix                                   |                                                                     3–6 days |
| P11–P15 campaign production       | FPV, DroneAid, Living Atlas, Retro, and Coupa campaigns                                                                   | 3–7 days per accepted campaign slice; full programme spans multiple releases |
| P16 supporting workflows          | Records, learning, replay, recovery, legacy curation, remaining supporting pages                                          |                                                                     2–4 days |
| P17 community guide               | Independently reproduced create/install/play/recover workflow                                                             |                                                                     1–2 days |
| P18 final qualification           | Accessibility, performance, storage, offline, recovery, physical devices, and public regression                           |                                        3–5 days after feature blockers close |

Online multiplayer, Deathmatch, full Ukrainian translation, hosted administration,
and persistent co-op saves remain deferred.

## 6. Blockers and concerns

1. **Serialized publishing:** only one task may merge, tag, archive, or deploy a
   release. Parallel work shortens preparation time but cannot make publication
   concurrent.
2. **Moving main:** publisher order is resolved: PR482 owns v0.112.0 and PR465
   moves behind the player releases. Every candidate must still reconcile the
   latest accepted predecessor before its earlier evidence can qualify the final
   head. PR478, PR447, and PR403 are superseded component branches, not
   independent release candidates.
3. **Temporary suite waiver:** long automated suites are skipped by committed
   policy. Focused tests, lint/format/validation, build/provenance, exact hashes,
   archives, and public checks remain mandatory. Skipped suites are not passes.
4. **Hardware evidence:** modeled controller tests and browser clicks are not
   physical Steam Deck/controller or touch certification. Those remain explicit
   acceptance limits.
5. **Disk and worktree pressure:** parallel hydrated worktrees filled the shared
   volume, and one focused Couch run lost its temporary worktree during execution.
   Release evidence requires a clean, coordinated, retained worktree and a
   maintained disk reserve.
6. **Large draft queue:** many open PRs are stacked studies or superseded
   candidates. Terminal aggregates must be rebuilt and predecessors closed only
   after public acceptance; merging every draft independently would duplicate or
   regress behavior.
7. **Human quality:** deterministic tests cannot establish fun, fairness,
   understandable failure, or willingness to retry. Campaign and Team adoption
   require human play review.
8. **Reference limits:** Xposed screenshots prove visible structure and art cues,
   not hidden timing, collision, or enemy rules. Reveal Line adaptations remain
   original and governed by explicit contracts.

## 7. Advancement rule

Every player-facing feature follows:

**Implement → review → focused test/fix → version → PR checks → protected merge →
exact-source qualification → immutable release → archive admission → Pages deploy
→ public version/bytes/play verification → next feature.**

A prepared branch, merged PR, or published tag alone is not public completion.
