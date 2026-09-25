# Reveal Line — accepted baseline and remaining player-first plan

Status checked **25 September 2026 after public acceptance of v0.113.1**.
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
`289b27033863bea1399df03eeb0f02c7ebb3bf01` were qualified. Forty-eight focused
tests passed before release. Validation, lint, both formatting gates, syntax,
production reproduction/readiness, deterministic build, frozen-artifact reread,
release-asset reconciliation, archive admission, selector validation, and Pages
assembly passed. The long source shards and focused publisher suites were
**waived by the committed fast-release policy** and are recorded as skipped.

The public payload was independently compared with its production receipt:
**4,710/4,710 files and 629,793,540/629,793,540 bytes matched**, with no failures
or retries. A public keyboard-only acceptance journey selected Classic from the
unified library, prepared First Signal with its 45% Classic target, started it
with Enter, paused with Escape, and resumed with Enter.

The replaced v0.113.0 site is preserved at
<https://mekhovov.github.io/revealline-archive-79/releases/v0.113.0/site/game/>.
Archive PR [#1](https://github.com/mekhovov/revealline-archive-79/pull/1), deployment
`6657384199`, and its **1,148-file / 595,654,470-byte** public audit passed.

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

| Priority | Delivery                                        | Current state                                                                                    | Completion gate                                                                                                                   |                     Engineering range |
| -------: | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------: |
|        1 | **UX2 — shared Home, lobbies, Pause; PR #487**  | Draft on an older base; prior candidate evidence exists but the current merge is conflicting     | Reconcile on v0.113.1, preserve direct entry/focus, verify keyboard/controller/touch flows, release and publicly accept           |                          **1–2 days** |
|        2 | **UX1-A — exact Journey rewards; PR #485**      | Draft; exact pictures, restore validation, focus recovery, and revision-safe caching implemented | Reconcile after UX2; verify reload, Retry/Next, missing-original recovery, release and publicly accept                            |                          **1–2 days** |
|        3 | **UX1-B — compact grouped mission gallery**     | Design/component foundations only                                                                | Group campaigns, restore selection/scroll, one-action ready/download-and-play, lazy previews, spatial input                       |                          **1–2 days** |
|        4 | **UX3 — gameplay HUD, touch and teaching**      | Partial responsive candidates                                                                    | One-row short-landscape HUD, maximum arena, shared touch layout, contextual hints, reduced effects, iPhone and Steam Deck checks  |            **1–2 days plus hardware** |
|        5 | **UX4 — start, failure and continuation**       | Partial countdown/retry/result candidates                                                        | Countdown/Go, destruction/life-loss, deliberate Retry, named successor/campaign endings, duplicate-award prevention               |                          **1–2 days** |
|        6 | **UX5 — remaining player screens**              | Foundations exist                                                                                | Settings, difficulty, Help, Collection/Records/replay and recovery with exact return focus and no Workshop dependency             |                          **1–2 days** |
|        7 | **UX6 — whole-player qualification**            | No accepted aggregate                                                                            | End-to-end accessibility, performance, storage, offline, recovery, controller and touch matrix                                    |             **2–4 days plus devices** |
|        8 | **Actor/action parity and enemy tuning**        | Shared assets and mechanics are partial                                                          | Distinct actor catalog, readable scale/heading/warnings, fair pressure, classic roles/powerups, deterministic bosses, Team parity |           **4–8 days plus playtests** |
|        9 | **Audio and finished music**                    | Runtime, MP3, playlist and authored-track foundations exist                                      | One audio authority, every mode, exact backup/offline, audible review, qualified synth/chiptune/rock/metal library                |                          **3–5 days** |
|       10 | **Studio, packs and reproducible authoring**    | Registries, validators, tools and 13 skills exist                                                | Fresh-workspace upload/edit/export/import/install/play/recover proof with exact original bytes                                    |                          **4–7 days** |
|       11 | **Campaign slices and final browser programme** | Numerous drafts; accepted inventory requires a new audit                                         | Player-approved benchmark, then FPV/DroneAid/Ukrainian/Retro/Coupa slices and final P18 qualification                             | **Several weeks; 3–7 days per slice** |

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

1. **Candidate drift:** UX2 PR #487 and rewards PR #485 are based on older main
   and conflict. Earlier passing evidence does not qualify their reconciled heads.
2. **Temporary test waiver:** long suites are skipped, increasing regression risk.
   Focused tests, static gates, exact source, immutable assets, archives and public
   checks remain mandatory until the waiver is retired.
3. **Physical hardware:** browser emulation cannot certify iPhone, tablet,
   DualSense, Steam Deck or other controllers. Implementation continues, but final
   support claims wait for real devices.
4. **Human quality gates:** difficulty fairness, replay value, cultural accuracy,
   actor readability and soundtrack quality require play/listening review.
5. **Publication cost:** each immutable release is roughly 596 MiB and must be
   preserved in a separate archive, selected serially and audited byte-for-byte.
6. **Local capacity:** the development volume was below 300 MiB free at this
   review. Hosted gates are usable, but obsolete clean worktrees must be retired
   before another local build or reconciliation.
7. **Large draft queue:** studies and stacked candidates overlap. Each successor
   must be reconciled by related hunks; bulk merging risks duplicate content,
   stale versions and incompatible identities.

## Immediate execution order

1. Retire only clean, obsolete v0.113.1 release worktrees after preserving Git and
   hosted evidence.
2. Reconcile UX2 PR #487 onto accepted v0.113.1, review at hunk level, qualify the
   new exact head, and release it as the next unused minor version.
3. Reconcile and release UX1-A, then implement/release UX1-B.
4. Ship UX3–UX6 as separate publicly verified player releases, prioritizing the
   one-row mobile HUD, consistent touch controls and controller A/start behavior.
5. Complete actor/action parity and enemy tuning before bulk campaign production.
6. Complete shared audio and authoring acceptance, then produce campaign slices.

## Advancement rule

Every player-facing item follows:

**reconcile accepted predecessor → implement/review related hunks → focused test
and browser proof → versioned PR → protected merge → exact-source qualification →
immutable release → predecessor archive → Pages selector PR → production deploy →
complete public-byte and scoped play verification → plan update.**

A prepared branch, passing component test, merged source PR, tag, uploaded artifact
or successful deployment alone is intermediate. A feature is Complete only after
the public verification boundary.
