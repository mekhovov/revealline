# Current delivery register — 22 September 2026

The current public release is **v0.84.0**. It is available at
[Play](https://mekhovov.github.io/revealline/game/) and as an immutable
[GitHub release](https://github.com/mekhovov/revealline/releases/tag/v0.84.0).
The root entry resolves to the versioned v0.84.0 graph; v0.83.0 remains
available through its preserved archive route.

## Completed and publicly accepted

| Item | Status | Acceptance evidence |
| --- | --- | --- |
| v0.83.0 default Journey | **Complete** | Source PR #263 merged at `01b189f64`; all 11,788 exact-source tests passed; immutable tag/release, selector PR #271 and Pages run `35775874062` passed. |
| v0.84.0 unified mission library | **Complete for scoped public acceptance** | Source PR #268 merged at `1107f570`; exact merged-source qualification and frozen inspection passed; immutable release has nine descriptor-matched assets; selector PR #274 and Pages run `35783546172` passed. |
| Unified public discovery | **Complete in scoped browser release** | The first browser load surfaced a dynamic-import failure with a usable Reload action; Reload recovered. The exact public app body matched the deployed source, and keyboard-only entry then opened one mission library with 201 Solo-visible Journey, Classic and Custom entries plus Solo, Versus and Team filters. Search, campaign and collection controls were exposed without a mouse. |
| Public version identity | **Complete** | Root `release.json`, versioned `release.json` and `game/build-info.json` all reported v0.84.0 and source `1107f570508e0d107440236b6aeedbce8506cd7d`. |
| Historical preservation | **Complete** | v0.83.0 is retained in Archive 52; its versioned release record still reports the original source `01b189f64`. |
| Public mission counts from v0.83 | **Preserved** | 91 Solo, 91 Versus and 12 Team Journey missions remain available; the v0.84 library additionally exposes retained Classic and Custom entries. |
| Public gameplay continuation | **Complete in prior scoped browser release** | Solo, Versus and Team wins advanced to named successors without a second Start action. Solo save/Continue survived reload. |
| Legacy compatibility | **Complete in prior scoped browser release** | A real 10.2 MiB Legacy chapter downloaded, verified, launched and returned to the retained Journey flight. |
| Compact viewport spotchecks | **Complete as browser checks** | Team and Playground retained the whole arena and critical controls at 390×844 and 844×390. Physical touch remains a separate gate. |

The bounded v0.83 record is in
[`evidence/v0830-public/`](evidence/v0830-public/README.md). v0.84 source,
release and publication evidence is retained by the merged pull requests,
workflow artifacts, immutable release assets and Archive 52 publication record.
A complete public-graph HTTP inventory audit is still running and remains a
separate evidence gate; the scoped player journeys above are already accepted.

PR #272 temporarily waives repository-wide automated suites after v0.83.0.
Releases made while that policy is active must label those suites as **waived**,
never passed. Validation, exact source identity, production reproduction, build/integrity,
immutable artifacts, deployment and basic public availability remain mandatory.
Extended manual gameplay, full browser matrices and physical-device journeys remain
useful evidence, but are nonblocking while the temporary waiver is active.

## Active next release

### R2 — v0.85.0 game-data replacement and recovery

**Status: in qualification. Priority: critical. Conditional ETA: 2–5 hours,
assuming no correction cycle.**

Current successor PR #275 reconciles the preserved work from PRs #252 and #257
onto the accepted v0.84.0 source without rewriting either owner branch. It adds:

- explicit Keep/Replace review before any game-data write;
- destination and earlier-release source rechecks before commit;
- verified Undo when the current profile can form a safe snapshot;
- failure, cancellation and uncertain-storage recovery without silent success;
- a commit hold so pending mastery writes cannot escape the backup boundary;
- keyboard/controller focus handoff to usable Cancel/Back actions;
- removal of obsolete chapter-picker tests after v0.84 replaced that surface
  with the separately tested unified mission library.

Current evidence on exact branch head `1b133430`:

- 135/135 focused backup, replacement, focus, Collection, mastery, transfer and
  recovery tests passed; no skips;
- the live Library operation harness passed 17/17 again after integration;
- validation, lint, formatting, native formatting and motion syntax passed;
- v0.85.0 is synchronized in package, lockfile and game build configuration;
- hosted PR build and exact-head qualification/freeze are in progress.

Remaining gates:

1. Complete hosted exact-head source gates, production reproduction, build and
   frozen-snapshot review; record the repository-wide suite as waived.
2. Obtain independent hunk/line review, mark PR #275 ready and merge it.
3. Re-run qualification and freeze on the exact merge commit.
4. Publish the immutable v0.85.0 tag and release assets.
5. Preserve v0.84.0 in the next archive, merge a separate selector PR, deploy
   Pages and prove source identity, integrity and basic availability. Record
   Keep, Replace, Undo, failed-import and focus-restoration journeys when run;
   the temporary waiver keeps those extended manual checks nonblocking.
6. Close PRs #252 and #257 as superseded only after v0.85.0 public acceptance.

## Prioritized remaining releases

Estimates begin after dependencies are publicly accepted. They are engineering
ranges; a failed gate adds a correction and requalification cycle.

| Order | Deliverable | State | ETA | Completion gate |
| ---: | --- | --- | --- | --- |
| 1 | **Backup replacement and recovery (PR #275)** | Qualification | **2–5 h** | Review-before-replace, Undo/failure recovery, restored focus, exact export/import and public proof. |
| 2 | **Retained presentation recovery (PR #256)** | Prepared behind backup work | **6–12 h** | Fresh-origin transfer retains exact presentation/media revisions and session-only originals. |
| 3 | **Chapter retry and Replay restoration (PRs #230, #231)** | Prepared, older base | **4–8 h each** | Current-main conflict resolution plus public keyboard/controller navigation and recovery. |
| 4 | **Native input and compact HUD** | Partial foundations | **1–3 days** | One consistent touch system in Solo/Versus/Team, reliable controller Start/A, one-row small-screen HUD, iPhone lifecycle and Steam Deck hardware evidence. |
| 5 | **Shared pixel presentation and actors** | Partial foundations | **3–6 days** | Readable typography, native menus, role-specific animated enemies/crafts, scale parity, trails, impacts, pickups, loss/recovery and victory effects across modes. |
| 6 | **Enemy intelligence and challenge** | Partial foundations | **3–6 days** | Faster but fair deterministic pressure, authored difficulty progression, role counters and measured human playtests. |
| 7 | **Music/media completion** | Partial | **2–5 days technical**, plus listening | Shared master controls, custom MP3 playlists in every mode, qualified built-in catalogue, video/GIF victory media and offline/recovery proof. Human listening remains separate. |
| 8 | **Creation and pack framework** | Partial | **2–5 days** | Asset/level/media/playlist editing, validation, import/export, exact-byte recovery and an independent fresh-workspace example. |
| 9 | **Team presentation stack** | Prepared chain | **1–3 days** | Reconcile PRs #234/#236/#238/#240/#243/#244/#245/#247, then #241; prove two-player readability and recovery. |
| 10 | **Campaign production slices** | Backlog | **3–7 days per reviewed slice** | Original maps, art, actors, audio, progression and rewards; each slice receives its own release and human review. |
| 11 | **Whole browser qualification** | Partial evidence | **2–5 days after feature freeze** | Full regression, cold offline, accessibility, performance, actual touch/controllers and support matrix. |
| Later | **Native iPhone/macOS/Steam/Steam Deck distribution** | Deferred | Separate estimates | Packaging, signing, lifecycle, files, audio sessions, stores and real hardware gates. |
| Later | **Network multiplayer** | Deferred | Separate programme | Authoritative simulation, private sessions, reconnect and failure handling. |

## Scope and evidence boundaries

- The 132-mission campaign programme remains a production backlog; current
  mission counts do not complete every planned theme or campaign.
- Automated tests, browser viewport checks, human playtests, physical devices,
  music listening and cultural review are separate evidence classes.
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
