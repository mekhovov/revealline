# Reveal Line — delivery status and remaining plan

Status checked **25 September 2026** after the public acceptance of v0.112.0.
This is the authoritative delivery summary. Detailed gameplay contracts, immutable
release receipts, research evidence, and historical reports remain authoritative
for their own scopes.

Effort ranges are engineering estimates from the moment an item becomes the only
release candidate. They include reconciliation, focused verification, review,
versioning, immutable release, archive preservation, Pages selection, and public
acceptance. They exclude unavailable physical-device or human-review time.
Skipped suites are never counted as passes.

## Public baseline — complete

**v0.112.0 — Player Quick Start** is the current public release:

- Play: <https://mekhovov.github.io/revealline/releases/v0.112.0/site/game/>
- Source PR: [#482](https://github.com/mekhovov/revealline/pull/482)
- Release: <https://github.com/mekhovov/revealline/releases/tag/v0.112.0>
- Pages selector PR: [#488](https://github.com/mekhovov/revealline/pull/488)
- Pages run: [36105363167](https://github.com/mekhovov/revealline/actions/runs/36105363167)

The release provides one-action valid-default entry, controller-confirm protection
during preparation, the reviewed FPV craft silhouette, and reconciled
trail/impact presentation. Closing a cut stops the craft until fresh directional
input while movement during a cut remains continuous.

Exact source `eca4e32baf190b2cf9184466a45b1627746c00ea`, tree
`03f11f09495c37202de795d5d9af10c9f908840e`, was qualified and preserved by
the immutable tag and nine release assets. Focused player cohorts passed
207/207, the original Team cohort 84/84, presentation 46/46, transfer 6/6,
and exact replay 38/38. Validation, lint, format, production reproduction,
readiness, frozen-artifact inspection, and release-asset reconciliation passed.
The long source shards were **waived by the committed fast-release policy** and
are recorded as skipped.

Archive77 preserves v0.111.1:

- Archive PR: [Archive77 #1](https://github.com/mekhovov/revealline-archive-77/pull/1)
- Infrastructure: `22865e8c736ef25f611ceed09fcd06e5e80a4730`
- Deployment: `6655347572`
- Complete audit: **1,146 files / 595,553,898 bytes**, zero failures or retries

The v0.112.0 Pages graph passed a second complete public audit of **4,650 files /
629,309,314 bytes**, with zero failures or retries. Fresh browser acceptance
opened Home, the 279-card Solo library, a prepared mission, live play, keyboard
Pause, and explicit keyboard Resume. These checks do not claim physical hardware,
offline, or campaign-balance acceptance.

## Completed foundations

| Area              | Delivered result                                                                                                                  | Remaining boundary                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Release safety    | Protected source PR, exact-source qualification, immutable release assets, per-release archive, reviewed selector, rollback route | Repeat for every release                             |
| Main entry        | Native title, Solo/Versus/Team routes, compact Home and direct player entry                                                       | Cross-mode shell consolidation in v0.114             |
| Mission discovery | One owner-aware library; 91 New Journey missions plus compatible Classic/custom entries                                           | Compact grouped gallery in v0.117                    |
| Movement          | Continuous directional steering during cuts; capture-stop after closure; explicit Pause/Resume                                    | Physical-device acceptance                           |
| Input             | Shared keyboard/controller foundations, confirm-echo guards, contextual touch controls                                            | Complete all-screen physical controller/touch matrix |
| Difficulty        | Gentle, Standard and Expert authored pressure foundations                                                                         | Human fairness and replay-value tuning               |
| Progression       | Cross-campaign Next, saves, scores, Collection and backup foundations                                                             | Exact cross-mode rewards and recovery closure        |
| Presentation      | Dark pixel shell, readable FPV craft, Team picture authority, trail/impact foundations                                            | Whole-game actor/effect parity                       |
| Content framework | Versioned rules, packs, optional chapters, media/playlist and Studio foundations                                                  | End-to-end creator acceptance and bulk production    |

The game is playable and publicly testable, but the complete original programme
is not finished. “Public baseline complete” means the v0.112.0 scope is accepted;
it does not mean every campaign, asset, soundtrack, device, or native-store goal
is complete.

## Active release queue

Only one feature aggregate owns a release slot. Component/study PRs remain
provenance and must not merge independently when an aggregate supersedes them.

| Priority | Release / owner                                        | Current state                                                                               | Work and acceptance remaining                                                                                                                                                                    |                         ETA |
| -------: | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------: |
|        1 | **v0.113.0 — Ukrainian spatial triptych, PR486**       | Draft; 73/73 focused tests on its old head; mergeable but 26 main commits behind            | Rebase/reconcile on v0.112, preserve exactly three prior v9 cards, bump version, rebuild production assets, rerun focused gates, cultural/visual browser review, qualify/release/archive/publish |            **0.5–1.5 days** |
|        2 | **v0.114.0 — shared Home/lobbies/Pause, PR487**        | Draft; focused navigation/input cohorts passed; currently conflicting and 26 commits behind | Reconcile after v0.113, preserve direct Start/Continue and exact opener focus, responsive keyboard/controller/touch review, release pipeline                                                     |                **1–2 days** |
|        3 | **v0.115.0 — exact Journey rewards, PR485**            | Draft; 117/117 scoped reward tests; conflicting and 29 commits behind                       | Reconcile after shell work, replace stale card-count expectation, browser reload/Retry/Next/missing-original checks, release pipeline                                                            |                **1–2 days** |
|        4 | **v0.116.0 — reviewed Team specialist library, PR475** | Draft foundation                                                                            | Reconcile dependency stack, expose all 12 entries, preserve Original editions, verify pictures/Next/Continue, human cooperative review and devices                                               |                **2–3 days** |
|        5 | **v0.117.0 — compact mission gallery**                 | Prepared concepts/components                                                                | Group all campaigns, restore selection, support ready/download-and-play, lazy media, keyboard/D-pad/touch spatial navigation                                                                     |                **1–2 days** |
|        6 | **v0.118.0 — small-screen HUD and touch parity**       | Partial; responsive candidates exist                                                        | One-row short-landscape HUD, consistent Solo/Versus/Team touch controls, full arena priority, iPhone browser lifecycle and Steam Deck controller journeys                                        |  **1–2 days** plus hardware |
|        7 | **v0.119.0 — deliberate failure/recovery**             | Partial candidates                                                                          | Countdown/Go, travelling impact, clear loss animation, no automatic terminal restart, guarded Retry, deterministic recovery                                                                      |              **1–1.5 days** |
|        8 | **v0.120.0 — settings/help/replay closure**            | Partial candidates                                                                          | Complete focus restoration, difficulty/help/replay/loading/recovery journeys without Workshop or mouse-only steps                                                                                |              **1–1.5 days** |
|        9 | **v0.121.0 — player-experience qualification**         | Not started as a final aggregate                                                            | End-to-end regression, accessibility, performance, storage, offline, controller/touch and public acceptance matrix                                                                               |  **2–4 days** plus hardware |
|       10 | **v0.122.0 — presentation parity**                     | Partial actor/map foundations                                                               | Reviewed pictures, role silhouettes, headings, warnings and animation across Solo/Versus/Team/imported content                                                                                   |                **2–4 days** |
|       11 | **v0.123.0 — complete music experience**               | Infrastructure exists                                                                       | Shared master authority in every mode, owned MP3 round-trip, mixed playlists, offline playback, auditioned synth/chiptune/rock/metal set                                                         | **3–5 days** plus listening |
|       12 | **v0.124.0 — creator framework, PR465 rebuilt**        | Large stale draft; 52+ commits behind its original base                                     | Rebuild on accepted player baseline, prove upload/edit/export/import/play/recover from a fresh workspace, update skills/prompts, qualify separately                                              |                **4–7 days** |

Version numbers remain tentative until the preceding public release is accepted
and the next unused semantic version is rechecked.

## Remaining original programme

| Phase               | Remaining work                                                                                                       |                                          Planning range |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------: |
| P01/P03/P05         | Finish native cross-mode loading, navigation, typography, Ukrainian palettes, zoom and reduced-effects parity        |                         Covered mainly by v0.114–v0.121 |
| P02-A/B             | One audio authority, custom MP3s everywhere, reliable playlist/offline/backup behavior, 24 auditioned tracks         |                                                3–5 days |
| P04/P17             | Creator Studio, registries, history, prompts, skills, CLI and independent reproducibility proof                      |                                                4–7 days |
| P06/P16             | Content install/replace/remove/recover, Collection, scores, learning, replay and legacy curation                     |                                                2–4 days |
| P07/P08             | Full-picture rewards/stories, exact art identity, actor animation, capture/loss/bonus/rescue feedback                |                                3–6 days across releases |
| P09/P10             | Smarter/fair enemies, classic roles/powerups, Tactical interactions, richer Team encounters and deterministic bosses |                                 4–8 days plus playtests |
| P11–P15             | FPV, DroneAid, Ukrainian culture, retro and spend-management campaign production                                     | **Several weeks**; 3–7 days per accepted campaign slice |
| P18                 | Browser/device performance, accessibility, storage, offline and recovery certification                               |       3–5 days after feature closure plus device access |
| Native stores       | iPhone/macOS/Steam/Steam Deck packaging, signing, lifecycle and store gates                                          |               Separate project after browser acceptance |
| Network multiplayer | Authoritative sessions, reconnect and failure handling                                                               |                                      Deferred follow-on |

The 132-new-Solo-mission campaign goal, complete 116-picture library, twelve
victory stories, 56 animated presentation sets, and finished 24-track collection
must be re-audited against accepted release inventories before claiming their
remaining numeric counts. Source artwork or draft records alone do not count as
installed, playable, accepted content.

## Blockers and concerns

1. **Physical hardware:** automated controller models and resized browser
   viewports cannot certify an iPhone, DualSense, or Steam Deck. Hardware
   availability is the only external blocker for final device acceptance.
2. **Human quality:** fun, fairness, cultural quality, soundtrack quality, and
   willingness to replay need human review. Deterministic tests cannot close
   these gates.
3. **Fast-release waiver:** long suites are temporarily skipped by explicit
   policy. Focused tests and all immutable release/publication guards remain
   mandatory. Restore full shards before the final public-release claim.
4. **Candidate drift:** PR486/487/485 are behind v0.112.0; their earlier passing
   tests do not qualify a reconciled head. Each must be rebuilt sequentially.
5. **Storage and publication cost:** each current release is roughly 596 MiB and
   needs a new historical archive plus a complete public audit. Disk/worktree
   pressure and hosted transfer time are material operational risks.
6. **Large draft queue:** many open PRs are component studies or superseded
   branches. Merging them independently risks duplicate content, version
   collisions, and regressions.
7. **Reference evidence:** XPOSED material supports visible structure and
   presentation comparisons; undocumented timing, collision, and AI behavior
   remain explicit Reveal Line design choices.

## Advancement rule

Every player-facing item follows:

**reconcile accepted predecessor → implement/review → focused test and browser
proof → versioned PR → protected merge → exact-source qualification → immutable
release → predecessor archive → Pages selector PR → production deployment →
complete public-byte and scoped play verification → plan update.**

A prepared branch, green component test, merged source PR, tag, or uploaded
artifact is an intermediate state. A release is Complete only after the public
verification boundary.
