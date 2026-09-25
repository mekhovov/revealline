# Reveal Line — accepted baseline and remaining player-first plan

Status checked **25 September 2026 while merged v0.114.0 source was undergoing
exact-source qualification**. v0.113.1 remains the accepted public boundary.
This is the current execution plan. Historical reports remain authoritative for
their own immutable releases; candidate branches and source assets do not count
as shipped gameplay.

Effort ranges start when an item becomes the sole release candidate. They include
reconciliation, focused verification, review, versioning, immutable release,
predecessor archive, Pages selection, complete public-byte verification, and a
scoped public play check. They exclude unavailable physical-device and human
review time. Temporarily waived suites are recorded as skipped and never counted
as passes.

## Accepted public baseline

**v0.113.1 — Classic preparation correction** is the latest accepted release:

- Play: <https://mekhovov.github.io/revealline/releases/v0.113.1/site/game/>
- Source PR: [#490](https://github.com/mekhovov/revealline/pull/490)
- Release: <https://github.com/mekhovov/revealline/releases/tag/v0.113.1>
- Pages selector PR: [#494](https://github.com/mekhovov/revealline/pull/494)
- Production workflow: [run 36117653770](https://github.com/mekhovov/revealline/actions/runs/36117653770)

The release makes Classic missions launched from the unified library retain their
Classic rules edition in every preparation path. Exact source
`7c6f84a473b3d2dca8f745c9a3bcc2745437f458` and source tree
`289b27033863bea1399df03eeb0f02c7ebb3bf01` were qualified. The immutable
`distribution.zip` SHA-256 is
`069ed3088d123cd42e5e9c46ccc7d75fb1a8f7ebec0e932e1d66a46ba4afa78c`.
Forty-eight focused tests passed before release. Validation, lint, both formatting
gates, syntax, production reproduction/readiness, deterministic build,
frozen-artifact reread, release-asset reconciliation, archive admission, selector
validation, and Pages assembly passed. The long source shards and focused
publisher suites were **waived by the committed fast-release policy** and are
recorded as skipped.

The public payload was independently compared with its production receipt:
**4,710/4,710 files and 629,793,540/629,793,540 bytes matched**, with no failures
or retries. A bounded public browser check on 25 September 2026 used the Codex
in-app browser at 1422 × 800. Continue launched the current New Journey, Missions
opened the unified library, the Classic filter exposed 188 Solo records, and First
Signal prepared with its 45% Classic target. Enter started the mission, Arrow Down
supplied directional input, Escape paused, and Enter resumed. No browser console
warnings or errors were captured.

That browser check was session-only because another game tab held the save lease.
It did not qualify persistence or reload, complete a mission, or cover touch,
physical controllers, responsive/mobile layouts, other browsers, offline use,
storage durability, download completion, or audio listening. Those remain
separate acceptance work.

The replaced v0.113.0 site is preserved at
<https://mekhovov.github.io/revealline-archive-79/releases/v0.113.0/site/game/>.
Archive PR [#1](https://github.com/mekhovov/revealline-archive-79/pull/1), deployment
`6657384199`, and its **1,148-file / 595,654,470-byte** public audit passed.

## Merged next release candidate

**v0.114.0 — Horizon Ukrainian spatial joins** is allocated to merged source PR
[#495](https://github.com/mekhovov/revealline/pull/495), not to UX2. Its exact
merged source is `10190539b243c9edc78eeef9dba174041409aaf2`. At the **25
September 2026, 11:51 CEST** snapshot, the exact-source qualification/freeze
[run 36120411263](https://github.com/mekhovov/revealline/actions/runs/36120411263)
was in progress: the qualification job had passed and the freeze job was still
running. The source promotes three existing Horizon identities into the default
v11 Journey route while retaining older editions.

Merge and qualification are intermediate states. v0.114.0 still needs successful
qualification and freeze, immutable release assets, preservation of the replaced
public release, a reviewed Pages selector, production deployment, complete public
byte verification, and scoped public play acceptance before it becomes the public
baseline.

## Completed work

| Area                     | Accepted result                                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release safety           | Protected feature and selector PRs, exact-source qualification, immutable tags/assets, per-release archives, reproducible Pages receipts, rollback paths, and full public-byte audits. |
| Entry                    | Native title, compact Home, Solo/Versus/Team routes, one-action Couch entry with valid defaults, and controller-confirm protection during preparation.                                 |
| Discovery                | One library containing 91 New Journey missions plus compatible Classic/custom records, with collection/campaign/mode filters.                                                          |
| Movement                 | Continuous steering during cuts; closing on revealed ground stops capture-stop craft until fresh input; explicit Pause/Resume; Immediate and Grid + buffer remain supported.           |
| Input foundations        | Shared keyboard/controller adapters, confirm-echo guards, contextual touch controls, and keyboard-only Classic launch/pause/resume evidence.                                           |
| Difficulty foundations   | Gentle, Standard, and Expert recipes; versioned pursuit/interception, terrain, patrol, and encounter foundations.                                                                      |
| Progression foundations  | Saves, scores, backups, Collection, cross-campaign continuation, exact mission identity, and release-safe restore foundations.                                                         |
| Presentation foundations | Dark pixel shell, cleaned FPV silhouette, direction-aware actors, Team picture authority, trail/impact feedback, readable text options, and Ukrainian-inspired spatial missions.       |
| Content framework        | Versioned rules, packs, optional chapters, media/playlists, asset registries, validators, Studio foundations, and AI authoring skills.                                                 |

## Player feedback status

| Requirement                              | Status                                                                    | Accepted result and remaining boundary                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stop after closing a cut                 | **Complete in authored capture-stop Solo; qualification remains broader** | Public behavior is shipped. Verify every advertised craft, mode, replay, touch, and physical controller.                                                    |
| Faster, smarter enemies                  | **Partial**                                                               | Pressure and interception systems exist. Human fairness, escape-route, loss-cause, and replay-value tuning remain.                                          |
| Animated, direction-facing enemies       | **Partial**                                                               | Heading and animation infrastructure exists. Finish distinct movement, warning, hit, recovery, scale, and purpose cues for every role.                      |
| Better trail/capture/loss/bonus feedback | **Partial**                                                               | Travelling line impacts and core effects exist. Finish mode parity, pickup clarity, reduced-effects equivalents, and asset-catalog cleanup.                 |
| Mouse-free menus                         | **Partial**                                                               | Multiple keyboard journeys pass, including public Classic launch. Every screen/dialog and physical controller journey still needs closure.                  |
| Consistent touch and Couch controls      | **Partial**                                                               | Contextual touch foundations exist. Solo, Versus, and Team still need one accepted control contract and real-phone acceptance.                              |
| Native small-screen/Steam Deck UX        | **Partial**                                                               | Compact shell and responsive candidates exist. One-row HUD, maximum arena height, browser chrome constraints, controller A/start, and real hardware remain. |
| Consistent modern pixel presentation     | **Partial**                                                               | Field Kit components and dark shell are integrated. Team, legacy rewards, actor catalog, typography, and settings parity remain.                            |

## Active delivery queue and ETA

Only one release owns publication at a time. A feature is Complete only after its
version is publicly deployed and verified.

The following queue observations are time-bounded snapshots, not permanent counts
or branch identities:

- Immediately before PR #493 merged at 11:32 CEST, the repository had **51 open
  pull requests, all 51 drafts**.
- At 11:50 CEST, UX2 PR
  [#487](https://github.com/mekhovov/revealline/pull/487) was reconciled onto the
  accepted v0.113.1 baseline at exact head
  `97a368de8083cef93caaf62cc0ec34064d1002d9`, with **24 changed paths**. Exact-head
  evidence passed quick-start parity **8/8**, controller Confirm guard plus release
  links **24/24**, queryless Versus entry **1/1**, Couch shell **22/22**, Team
  default entry **12/12**, Team originals/pressure/timed **17/17**, validation,
  scoped lint/format/diff checks, native format, and Motion Lab syntax. Long suites
  remained waived and an earlier resource-limited concurrent run was not counted.
- UX2 browser review found a **release-blocking cross-mode Pause hierarchy
  inconsistency**, now being fixed. Other exercised desktop and portrait direct
  Start, Settings, More, and Pause paths were clean, with zero console errors and
  zero horizontal overflow. This does not qualify physical controller/touch
  hardware or the not-yet-fixed Pause hierarchy.
- UX1-A PR [#485](https://github.com/mekhovov/revealline/pull/485) remained draft
  and unversioned at exact head
  `4ea9ce45548d35dc1563f8e5126d5c970f434a1b`. Its complete real
  `candidate-versus-host` file passed **13/13** with zero skips in 286.8 seconds;
  lint, both format checks, validation, motion-lab syntax, and `git diff --check`
  passed. Its reward/storage/artwork/current-authority/Legacy Team/real Solo and
  Team cohort passed **117/117**, and the changed all-campaign Versus reward paths
  passed **2/2**. This evidence does not qualify the required post-UX2 rebase or
  the outstanding real-browser reward recovery flows.

| Priority | Delivery                                        | Current state                                                                                            | Completion gate                                                                                                                   |                     Engineering range |
| -------: | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------: |
|        1 | **v0.114.0 — Horizon spatial joins; PR #495**   | Merged at exact source `10190539b`; qualification passed, freeze in progress; not public                 | Complete freeze, immutable release, archive/selector, production deployment, public bytes and scoped play                         |          **Hours, hosted-gate bound** |
|        2 | **UX2 — shared Home, lobbies, Pause; PR #487**  | Reconciled 24-path draft at `97a368de8`; focused evidence green; cross-mode Pause hierarchy fix underway | Fix and re-review Pause hierarchy, reconcile on the accepted v0.114.0 boundary, verify input flows, release and publicly accept   |                          **1–2 days** |
|        3 | **UX1-A — exact Journey rewards; PR #485**      | Draft head and focused evidence recorded above; reconciliation must follow UX2                           | Reconcile after UX2; verify reload, Retry/Next, missing-original recovery, release and publicly accept                            |                          **1–2 days** |
|        4 | **UX1-B — compact grouped mission gallery**     | Design/component foundations only                                                                        | Group campaigns, restore selection/scroll, one-action ready/download-and-play, lazy previews, spatial input                       |                          **1–2 days** |
|        5 | **UX3 — gameplay HUD, touch and teaching**      | Partial responsive candidates                                                                            | One-row short-landscape HUD, maximum arena, shared touch layout, contextual hints, reduced effects, iPhone and Steam Deck checks  |            **1–2 days plus hardware** |
|        6 | **UX4 — start, failure and continuation**       | Partial countdown/retry/result candidates                                                                | Countdown/Go, destruction/life-loss, deliberate Retry, named successor/campaign endings, duplicate-award prevention               |                          **1–2 days** |
|        7 | **UX5 — remaining player screens**              | Foundations exist                                                                                        | Settings, difficulty, Help, Collection/Records/replay and recovery with exact return focus and no Workshop dependency             |                          **1–2 days** |
|        8 | **UX6 — whole-player qualification**            | No accepted aggregate                                                                                    | End-to-end accessibility, performance, storage, offline, recovery, controller and touch matrix                                    |             **2–4 days plus devices** |
|        9 | **Actor/action parity and enemy tuning**        | Shared assets and mechanics are partial                                                                  | Distinct actor catalog, readable scale/heading/warnings, fair pressure, classic roles/powerups, deterministic bosses, Team parity |           **4–8 days plus playtests** |
|       10 | **Audio and finished music**                    | Runtime, MP3, playlist and authored-track foundations exist                                              | One audio authority, every mode, exact backup/offline, audible review, qualified synth/chiptune/rock/metal library                |                          **3–5 days** |
|       11 | **Studio, packs and reproducible authoring**    | Registries, validators, tools and 13 skills exist                                                        | Fresh-workspace upload/edit/export/import/install/play/recover proof with exact original bytes                                    |                          **4–7 days** |
|       12 | **Campaign slices and final browser programme** | Numerous drafts; accepted inventory requires a new audit                                                 | Player-approved benchmark, then FPV/DroneAid/Ukrainian/Retro/Coupa slices and final P18 qualification                             | **Several weeks; 3–7 days per slice** |

## Original phase register

| Phase                      | Status       | Completed                                                                 | Remaining                                                                                               |                Planning range |
| -------------------------- | ------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------: |
| P00 reference/baseline     | **Complete** | Reference discipline, compatibility baselines and versioned release train | Maintain evidence labels and compatibility with every successor                                         |                       ongoing |
| P01 loading feedback       | **Partial**  | Core preparation status, cancellation and state preservation              | Close every distinct Library/craft/media slow, failed, cancelled, cached, and stale path                |                within UX2–UX5 |
| P02-A sound authority      | **Partial**  | Shared runtime controls and media foundations                             | One master authority across previews, effects, music and video; late-promise and gesture recovery       |                  **1–2 days** |
| P02-B music experience     | **Partial**  | MP3/playlist infrastructure and playable authored music                   | Cross-mode custom music, mixed playlists, transfer/offline and audited finished library                 |                  **2–3 days** |
| P03 native navigation      | **Partial**  | Title, Home, player modes and many keyboard paths                         | UX2–UX6, full focus restoration, Back/Resume and physical controller evidence                           | **5–10 days across releases** |
| P04 creation framework     | **Partial**  | Versioned registries, Studio and validators                               | Complete editors/previews/history/bundles and exact end-to-end demonstration                            |                  **3–5 days** |
| P05 readable presentation  | **Partial**  | Dark pixel shell, readable options and shared components                  | Team/legacy parity, Ukrainian palettes, EN/UA glyphs, zoom and reduced-effects audit                    |                  **2–4 days** |
| P06 discovery/install      | **Partial**  | Unified mission library and optional chapter foundations                  | Reliable install/replace/remove/recover, capacity validation and interrupted-install preservation       |                  **2–4 days** |
| P07 rewards/continuation   | **Partial**  | Results, saves, Collection and continuation foundations                   | Exact Retry/Next, full-picture celebration, optional stories and duplicate-reward proof                 |                  **2–4 days** |
| P08 art/actors/action      | **Partial**  | FPV, shared renderer and effect foundations                               | Complete role catalog, animated sets, gameplay scale, warnings, bonuses, loss/recovery and Team parity  |                  **3–6 days** |
| P09 challenge/intelligence | **Partial**  | Versioned pressure, terrain and encounter primitives                      | Fair tuning, classic role completeness, four powerups, tactical counters and deterministic bosses       |   **4–8 days plus playtests** |
| P10 Team encounters        | **Partial**  | Team engine, missions, shared objectives and artwork authority            | Rich First Connection/Relay Yard variants, rescue/support clarity and separate device matrix            |                  **2–4 days** |
| P11 FPV campaigns          | **Queued**   | Reusable foundations and candidate content                                | Four accepted 12-mission campaigns                                                                      |        **3–7 days per slice** |
| P12 DroneAid campaigns     | **Queued**   | Class/ability foundations                                                 | Four accepted 12-mission campaigns with distinct Support/Combat framing                                 |        **3–7 days per slice** |
| P13 Ukrainian culture      | **Queued**   | Ukrainian-inspired art and spatial-study foundations                      | Twelve reviewed Living Atlas missions                                                                   |                  **3–7 days** |
| P14 retro arcade           | **Queued**   | Retro shell/music foundations                                             | Twelve distinct After School Arcade missions                                                            |                  **3–7 days** |
| P15 spend management       | **Queued**   | Theme/framework concepts                                                  | Twelve understandable noncombat Spend in Motion missions                                                |                  **3–7 days** |
| P16 supporting workflows   | **Partial**  | Collection, scores, saves, replay and recovery foundations                | Whole-player closure and legacy curation                                                                |                  **2–4 days** |
| P17 reproducible authoring | **Partial**  | 13 AI skills, prompts, CLIs and docs                                      | Independent fresh-workspace create/install/play/export/recover acceptance                               |                  **2–4 days** |
| P18 browser qualification  | **Partial**  | Extensive automated/emulated/public evidence                              | Retire waiver; complete performance, accessibility, media/offline, real touch/controller support matrix |     **3–5 days plus devices** |
| Native distribution        | **Deferred** | Wrapper foundations only                                                  | iPhone, macOS, Steam/Deck lifecycle, signing, packaging, stores and hardware gates                      |              separate project |
| Network multiplayer        | **Deferred** | Couch modes only                                                          | Authoritative sessions, reconnect and failure handling                                                  |                     follow-on |

The 132-new-Solo-mission target, 116-picture library, 12 victory stories, 56
complete animated presentation sets, and 24-track finished album require a fresh
accepted-release inventory before any remaining count is claimed. Draft files and
reserve art are not installed, playable content.

## Blockers and concerns

1. **Serialized public boundary:** PR #495 merged and owns v0.114.0, but its
   exact-source qualification and complete release/publication path are not yet
   finished. v0.113.1 remains the predecessor for acceptance claims.
2. **UX2 browser blocker and drift:** PR #487 was reconciled to accepted v0.113.1,
   but its cross-mode Pause hierarchy is inconsistent and main has since advanced
   through merged PR #495. Fix the hierarchy, then reconcile and qualify on the
   accepted v0.114.0 boundary. PR #485 follows UX2.
3. **Temporary test waiver:** long suites are skipped, increasing regression risk.
   Focused tests, static gates, exact source, immutable assets, archives and public
   checks remain mandatory until the waiver is retired.
4. **Physical hardware:** browser emulation cannot certify iPhone, tablet,
   DualSense, Steam Deck or other controllers. Implementation continues, but final
   support claims wait for real devices.
5. **Human quality gates:** difficulty fairness, replay value, cultural accuracy,
   actor readability and soundtrack quality require play/listening review.
6. **Publication cost:** each immutable release is roughly 596 MiB and must be
   preserved in a separate archive, selected serially and audited byte-for-byte.
7. **Local capacity:** cleanup raised free space to about **5.1 GiB**, with **213
   worktrees** still registered at the 11:50 CEST snapshot. This is enough for
   focused work but remains tight for roughly 596 MiB releases, large checkouts,
   builds, and multiple reconciliations; continue retiring only verified obsolete
   worktrees.
8. **Large draft queue:** at the timestamped observation above, all 51 open PRs
   were drafts and many studies or stacked candidates overlapped. Each successor
   must be reconciled by related hunks; bulk merging risks duplicate content,
   stale versions and incompatible identities.

## Immediate execution order

1. Complete v0.114.0 exact-source qualification, immutable release, predecessor
   archive, Pages selection, deployment, public-byte audit, and scoped public play
   acceptance before changing the public boundary.
2. Fix the release-blocking UX2 Pause hierarchy inconsistency and repeat the clean
   desktop/portrait direct Start, Settings, More, and Pause browser matrix.
3. After v0.114.0 is accepted publicly, reconcile UX2 onto that exact source,
   qualify the new head, and release it under the next unused version.
4. Reconcile and release UX1-A, then implement/release UX1-B.
5. Ship UX3–UX6 as separate publicly verified player releases, prioritizing the
   one-row mobile HUD, consistent touch controls and controller A/start behavior.
6. Complete actor/action parity and enemy tuning before bulk campaign production.
7. Complete shared audio and authoring acceptance, then produce campaign slices.

## Advancement rule

Every player-facing item follows:

**reconcile accepted predecessor → implement/review related hunks → focused test
and browser proof → versioned PR → protected merge → exact-source qualification →
immutable release → predecessor archive → Pages selector PR → production deploy →
complete public-byte and scoped play verification → plan update.**

A prepared branch, passing component test, merged source PR, tag, uploaded artifact
or successful deployment alone is intermediate. A feature is Complete only after
the public verification boundary.
