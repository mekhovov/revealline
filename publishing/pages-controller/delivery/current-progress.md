# Current delivery register — 22 September 2026

The current public release is **v0.83.0**. It is available at
[Play](https://mekhovov.github.io/revealline/game/) and as an immutable
[GitHub release](https://github.com/mekhovov/revealline/releases/tag/v0.83.0).
The missing-levels issue is closed: queryless public entry now exposes the New
Journey by default in every current mode.

## Completed and publicly accepted

| Item | Status | Acceptance evidence |
| --- | --- | --- |
| v0.83.0 default Journey | **Complete** | Source PR #263 merged at `01b189f64`; all 11,788 exact-source tests passed; immutable tag/release published; selector PR #271 and Pages run `35775874062` passed. |
| Public mission discovery | **Complete** | 91 Solo, 91 Versus and 12 Team missions are visible without special query parameters; Legacy remains explicit. |
| Public gameplay continuation | **Complete in scoped browser release** | Solo, Versus and Team wins advanced to named successors without a second Start action. Solo save/Continue survived reload. |
| Legacy compatibility | **Complete in scoped browser release** | A real 10.2 MiB Legacy chapter downloaded, verified, launched and returned to the retained Journey flight. |
| Public Pages bytes | **Complete within recorded bounds** | The authenticated artifact contains 3,809 files / 613,866,928 bytes. Public HTTP readback verified 135 affected files / 258,792,093 bytes, including all 103 Journey pictures. |
| Historical preservation | **Complete** | v0.82.1 is retained in Archive 51 and its versioned game route returns successfully. |
| Playground route | **Complete for the corrected path** | Workshop launched First Signal with `practice=1`; play/pause worked and no campaign reward was granted. |
| Compact viewport spotchecks | **Complete as browser checks** | Team and Playground retained the whole arena and critical controls at 390×844 and 844×390. Physical touch remains a separate gate. |

The complete bounded record is in
[`evidence/v0830-public/`](evidence/v0830-public/README.md).

PR #272 is an infrastructure-only policy change merged after v0.83.0. It did
not alter v0.83.0 and did not waive any of its 11,788 passing tests. Future
releases made while the temporary policy is active must label automated suites
as **waived**, never passed, and still prove source identity, validation,
build/integrity, immutable artifacts, deployment and public behavior.

## Active next release

### R1 — v0.84.0 unified mission library

**Status: in progress. Priority: critical. Current conditional public target:
20:50–21:30 UTC (22:50–23:30 Berlin), assuming no correction cycle.**

Draft PR #268 already contains the large implementation: one native mission
browser for Journey, Classic and Custom content across Solo, Versus and Team;
search and filters; exact edition-aware launch; explicit download/readiness;
safe replacement; retained focus/scroll; and owner-authored Next sequences.

Accepted main and the temporary release policy are integrated in `99ba045`; the
v0.84.0 release preparation is committed in `29b70c14`. Mandatory validation,
lint, formatting, motion syntax and Field Kit checks passed. The promotion owner
has pushed qualification handoff `9ec1a793` and is retargeting PR #268 to main.

Remaining gates:

1. Finish exact-head review and required hosted PR/build checks.
2. Repeat release-aware paired-media and arbitrary Custom-raster preservation
   checks on the exact integrated source.
3. Merge the reviewed source PR and run the exact merged-source qualification,
   build, integrity and focused browser checks. Record waived suites truthfully.
4. Freeze the qualified source; create immutable release assets and tag.
5. Merge a separate selector PR, deploy Pages, and verify public Solo, Versus,
   Team, Legacy, Custom download/replacement and Next/Back journeys.

## Prioritized remaining releases

Estimates start after their dependency is accepted. They are engineering ranges,
not calendar promises; a failed gate adds a correction and requalification
cycle.

| Order | Deliverable | State | ETA | Completion gate |
| ---: | --- | --- | --- | --- |
| 1 | **Unified mission library (PR #268)** | In promotion | **20:50–21:30 UTC conditional target** | v0.84.0 public and verified as described above. |
| 2 | **Backup replacement and recovery (PRs #252, #257)** | Prepared, needs current-main reconciliation | **4–8 h** | Review-before-replace, Undo/failure recovery, restored focus, exact export/import and public proof. |
| 3 | **Retained presentation recovery (PR #256)** | Prepared behind backup work | **6–12 h** | Fresh-origin transfer retains exact presentation/media revisions and session-only originals. |
| 4 | **Chapter retry and Replay restoration (PRs #230, #231)** | Prepared, older base | **4–8 h each** | Current-main conflict resolution plus public keyboard/controller navigation and recovery. |
| 5 | **Native input and compact HUD** | Partial foundations | **1–3 days** | One consistent touch control system in Solo/Versus/Team, reliable controller Start/A, one-row small-screen HUD, iPhone lifecycle and Steam Deck hardware evidence. |
| 6 | **Shared pixel presentation and actors** | Partial foundations | **3–6 days** | Readable typography, native menus, role-specific animated enemies/crafts, scale parity, trails, impacts, pickups, loss/recovery and victory effects across modes. |
| 7 | **Enemy intelligence and challenge** | Partial foundations | **3–6 days** | Faster but fair deterministic pressure, authored difficulty progression, role counters and measured human playtests. |
| 8 | **Music/media completion** | Partial | **2–5 days technical**, plus listening | Shared master controls, custom MP3 playlists in every mode, qualified built-in catalogue, video/GIF victory media and offline/recovery proof. Human listening remains separate. |
| 9 | **Creation and pack framework** | Partial | **2–5 days** | Asset/level/media/playlist editing, validation, import/export, exact-byte recovery and an independent fresh-workspace example. |
| 10 | **Team presentation stack** | Prepared chain | **1–3 days** | Reconcile PRs #234/#236/#238/#240/#243/#244/#245/#247, then #241; prove two-player readability and recovery. |
| 11 | **Campaign production slices** | Backlog | **3–7 days per reviewed slice** | Original maps, art, actors, audio, progression and rewards; each slice receives its own release and human review. |
| 12 | **Whole browser qualification** | Partial evidence | **2–5 days after feature freeze** | Full regression, cold offline, accessibility, performance, actual touch/controllers and support matrix. |
| Later | **Native iPhone/macOS/Steam/Steam Deck distribution** | Deferred | Separate estimates | Packaging, signing, lifecycle, files, audio sessions, stores and real hardware gates. |
| Later | **Network multiplayer** | Deferred | Separate programme | Authoritative simulation, private sessions, reconnect and failure handling. |

## Work that must not be mistaken for completion

- The 132-mission campaign programme remains a production backlog; current
  mission counts do not complete every planned theme or campaign.
- Automated tests, browser viewport checks, human playtests, physical devices,
  music listening and cultural review are distinct evidence classes.
- Draft PRs are retained work, not accepted features. They ship only after
  current-base review, an atomic PR, a versioned immutable release and public
  verification.
- The unrelated dirty root workspace remains untouched; release work uses
  isolated worktrees and hunk/line-level staging.

## Continuous-delivery rule

Finish one bounded item, review and stage only related hunks, merge its source
PR, publish an immutable version, update the Pages selector through a separate
PR, and verify the actual public bytes and player journey before marking it
complete. Corrections receive new versions; published releases are never
overwritten.
