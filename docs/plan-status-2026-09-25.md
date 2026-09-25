# Reveal Line — completed work and remaining player-first plan

Status checked **25 September 2026 at the v0.113.0 → v0.113.1 release boundary**.
This is the current delivery summary. Detailed gameplay contracts, immutable
release receipts, research evidence, and historical reports remain authoritative
for their own scopes.

Effort ranges start when an item becomes the sole release candidate. They include
reconciliation, focused verification, review, versioning, immutable release,
archive preservation, Pages selection, and public acceptance. They exclude
unavailable physical-device or human-review time. Skipped suites are never
counted as passes.

## Completed and public

**v0.112.0 — Player Quick Start** is the last fully accepted public baseline:

- Play: <https://mekhovov.github.io/revealline/releases/v0.112.0/site/game/>
- Source PR: [#482](https://github.com/mekhovov/revealline/pull/482)
- Release: <https://github.com/mekhovov/revealline/releases/tag/v0.112.0>
- Pages selector PR: [#488](https://github.com/mekhovov/revealline/pull/488)

It provides one-action Couch entry with valid defaults, controller-confirm
protection during preparation, the cleaned FPV craft silhouette without detached
white corner rotors, and reconciled trail/impact presentation. Closing a cut
stops the craft until fresh directional input while movement during a cut remains
continuous.

Exact source `eca4e32baf190b2cf9184466a45b1627746c00ea` was qualified and
preserved by its immutable tag and release assets. Focused player, Team,
presentation, transfer, and replay cohorts passed. Validation, lint, formatting,
production reproduction/readiness, frozen-artifact inspection, release-asset
reconciliation, archive admission, and public-byte verification passed. The long
source shards were **waived by the committed fast-release policy** and are
recorded as skipped.

## Completed foundations

| Area              | Delivered result                                                                                                | Remaining boundary                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Release safety    | Protected source PRs, exact-source qualification, immutable assets, per-release archives and reviewed selectors | Repeat for every release and retire the temporary waiver |
| Entry             | Native title, Solo/Versus/Team routes, compact Home and direct valid-default player entry                       | Finish the shared shell in UX2                           |
| Discovery         | Owner-aware library with 91 New Journey missions and compatible Classic/custom entries                          | Compact grouped gallery in UX1-B                         |
| Movement          | Continuous directional steering during cuts, capture-stop after closure and explicit Pause/Resume               | Physical-device acceptance                               |
| Input             | Shared keyboard/controller foundations, confirm-echo guards and contextual touch controls                       | Complete all-screen hardware matrix                      |
| Difficulty        | Gentle, Standard and Expert authored pressure foundations                                                       | Human fairness and replay-value tuning                   |
| Progression       | Cross-campaign Next, saves, scores, Collection and backup foundations                                           | Exact cross-mode rewards and recovery closure            |
| Presentation      | Dark pixel shell, cleaned FPV craft, Team picture authority and trail/impact foundations                        | Whole-game actor/effect parity                           |
| Content framework | Versioned rules, packs, optional chapters, media/playlist and Studio foundations                                | End-to-end creator acceptance and bulk production        |

## Active release queue and ETA

Only one release owns publishing at a time. Implementation and review may continue
in parallel, but a successor cannot merge until the selected public predecessor
is verified. Version numbers after the hotfix are deliberately unassigned until
the next unused version is checked.

| Priority | Release / owner                                         | Current state                                                                                                   | Acceptance remaining                                                                                                                                                     |                                   ETA from now |
| -------: | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------: |
|        1 | **v0.113.0 — Ukrainian spatial triptych**               | Immutable release and selector PR #492 merged; Pages deployment is active                                       | Verify exact public source/bytes and bounded Solo, Versus and Team entry. A known Classic preparation defect prevents treating it as the durable baseline.               |                              **0.5–1.5 hours** |
|        2 | **v0.113.1 — Classic preparation correction, PR #490**  | Focused implementation and static gates pass; earlier hosted checks correctly blocked before v0.113.0 selection | Reconcile onto the selector merge, run fresh exact-head gates, merge, qualify, freeze, publish, archive v0.113.0, select Pages and verify Classic plus ordinary journeys |         **3–6 hours after v0.113.0 is public** |
|        3 | **UX2 — shared Home/lobbies/Pause, PR #487**            | Draft; direct entry, compact shell and navigation cohorts pass; short-landscape Team focus defect fixed         | Reconcile on accepted v0.113.1, preserve opener/focus and direct entry, rerun focused/static/build plus keyboard/controller/touch browser review, then version/release   |                                   **1–2 days** |
|        4 | **UX1-A — exact Journey rewards, PR #485**              | Draft; exact pictures, restore validation, focus recovery and revision-safe caching implemented                 | Finish integrated verification, reconcile after UX2, verify reload/Retry/Next/missing-original behavior, then version/release                                            |                         **1–2 days after UX2** |
|        5 | **UX1-B — compact grouped mission gallery**             | Design and component foundations exist; no accepted aggregate release                                           | Group campaigns, restore selection/scroll, one-action ready/download-and-play, lazy previews and spatial keyboard/D-pad/touch navigation                                 |                                   **1–2 days** |
|        6 | **UX3 — gameplay layout and teaching**                  | Partial responsive candidates                                                                                   | Shared HUD hierarchy, short-landscape board/control fit, contextual first-play hints and reduced-effects variants                                                        |              **1–2 days plus hardware checks** |
|        7 | **UX4 — start, failure and continuation**               | Partial countdown/retry/result candidates                                                                       | Countdown/Go timing, deliberate terminal Retry, named successors and campaign endings without duplicate awards or stale launches                                         |                                   **1–2 days** |
|        8 | **UX5 — remaining player screens**                      | Foundations exist                                                                                               | Settings, difficulty, Help, Collection/Records/replay and recovery with exact return focus and no Workshop dependency                                                    |                                   **1–2 days** |
|        9 | **UX6 — whole-player qualification**                    | Not started as a final aggregate                                                                                | End-to-end journeys, accessibility, performance, storage, offline and physical controller/touch evidence                                                                 |                **2–4 days plus device access** |
|       10 | **Map/presentation parity and Team specialist library** | Shared artwork/actor foundations and draft PR #475 exist                                                        | Complete existing Solo/Versus/Team/imported roles, pictures, headings and warnings; human cooperative review                                                             |                                   **2–4 days** |
|       11 | **Audio and full theme/Studio workflows**               | Runtime and authoring foundations exist                                                                         | Shared audio authority, auditioned music, exact theme restoration, cross-mode Studio previews and fresh-workspace creator proof                                          |               **4–8 days split into releases** |
|       12 | **Campaign production and final programme**             | Many content slices are drafts, not accepted releases                                                           | Encounter/difficulty qualification, FPV/DroneAid/Living Atlas/Retro/Coupa production, supporting workflows and P18 qualification                                         | **Several weeks; 3–7 days per campaign slice** |

## Immediate execution order

1. Preserve the verified immutable v0.113.0 evidence and current public identity.
2. Admit the successful Archive79 evidence, select v0.113.1, deploy Pages and verify
   the Classic correction plus ordinary mode entry.
3. Reconcile and ship UX2 before rewards, because both touch Couch hosts and shell
   ownership.
4. Reconcile and ship UX1-A rewards, then implement UX1-B gallery.
5. Continue UX3–UX6 as separate, publicly verified player releases.
6. Resume creator/admin aggregates and bulk campaign production after the ordinary
   player journey is reliable.

## Remaining original programme

| Phase               | Remaining work                                                                                               |                            Planning range |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------: |
| P01/P03/P05         | Native cross-mode loading, navigation, typography, Ukrainian palettes, zoom and reduced-effects parity       |                            Mainly UX2–UX6 |
| P02-A/B             | One audio authority, custom MP3s everywhere, playlist/offline/backup behavior and auditioned tracks          |                                  3–5 days |
| P04/P17             | Creator Studio, registries, history, prompts, skills, CLI and independent reproducibility                    |                                  4–7 days |
| P06/P16             | Content install/replace/remove/recover, Collection, scores, learning, replay and legacy curation             |                                  2–4 days |
| P07/P08             | Full-picture rewards/stories, exact art identity, actor animation and capture/loss/bonus/rescue feedback     |                  3–6 days across releases |
| P09/P10             | Fair enemies, classic roles/powerups, tactical interactions, richer Team encounters and deterministic bosses |                   4–8 days plus playtests |
| P11–P15             | FPV, DroneAid, Ukrainian culture, retro and spend-management campaign production                             |         Several weeks; 3–7 days per slice |
| P18                 | Browser/device performance, accessibility, storage, offline and recovery certification                       |       3–5 days after closure plus devices |
| Native stores       | iPhone/macOS/Steam/Steam Deck packaging, signing, lifecycle and store gates                                  | Separate project after browser acceptance |
| Network multiplayer | Authoritative sessions, reconnect and failure handling                                                       |                        Deferred follow-on |

The 132-new-Solo-mission goal, complete picture library, victory stories, animated
presentation sets and finished soundtrack must be re-audited against accepted
release inventories before claiming remaining numeric counts. Draft source assets
alone do not count as installed, playable and accepted content.

## Blockers and concerns

1. **Known selected-release defect:** v0.113.0 remains selected with the Classic
   preparation defect. v0.113.1 is immutable and published; Archive79 now deploys
   successfully, leaving selector deployment and public verification.
2. **Release serialization:** immutable release, archive, selector and Pages
   deployment are single-owner operations. Parallel implementation reduces coding
   idle time but cannot safely parallelize publication.
3. **Candidate drift:** PR #487 and #485 conflict while main advances. Earlier
   passing evidence does not qualify a reconciled head.
4. **Fast-release waiver:** long suites are temporarily skipped and never reported
   as passes. Focused tests, static gates, exact source, frozen assets, archive
   admission and public checks remain mandatory.
5. **Physical hardware:** modeled controller and browser touch checks cannot certify
   Steam Deck, gamepad, iPhone or tablet hardware. Device access is an external
   acceptance dependency, not a reason to stop implementation.
6. **Human quality:** difficulty fairness, replay value, cultural review and
   soundtrack quality require human play/listening beyond deterministic tests.
7. **Storage and transfer cost:** each immutable release is about 596 MiB and needs
   a new archive plus public-byte audit. Hosted transfer and local worktree capacity
   remain material risks.
8. **Large draft queue:** many PRs are studies, components or superseded stacks.
   Merging them independently would create duplicate content and version collisions.

## Advancement rule

Every player-facing item follows:

**reconcile accepted predecessor → implement/review → focused test and browser
proof → versioned PR → protected merge → exact-source qualification → immutable
release → predecessor archive → Pages selector PR → production deployment →
complete public-byte and scoped play verification → plan update.**

A prepared branch, green component test, merged source PR, tag or uploaded artifact
is intermediate. A release is Complete only after the public verification boundary.
