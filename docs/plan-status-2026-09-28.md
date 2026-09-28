# RevealLine — current completion and remaining delivery plan

Status checked **28 September 2026** against current `main`, GitHub releases, open pull
requests, the Pages publication record and retained verification. This document
supersedes dated queue/version claims in the 27 September status while preserving that
file as historical evidence.

## Current boundary

- Current `main`: `4cb5e3199eb0a4c1cee61360ab1dff6a0e866caa`.
- Published release: `v0.141.7`, frozen game source
  `efbb3882b4edd447c8e9f60ed60c536a956d78f3`.
- GitHub release and Pages publication completed; the complete current public audit
  matched **2,223 files** with no byte failures.
- Bounded public gameplay/offline acceptance is still pending. Publication and byte
  integrity do not by themselves prove the player journey.
- v0.141.7 integrates the fifty previously queued source PR inputs. Their older
  v0.141.8–v0.143.0 labels are therefore no longer authoritative implementation
  boundaries; remaining work is acceptance, correction and successor behavior.
- PR #716, canonical/external soundtrack streaming, remains a separate conflicted
  successor under its existing owner. It is being reconciled independently and is not
  part of this gameplay batch.

## Completed or available in the published cumulative line

- Core capture-stop movement, fair straight-between-impact ordinary enemy motion,
  warned pressure roles, travelling trail impacts and preserved historical rules.
- Shared difficulty and admin tuning, current FPV actor defaults, appearance choices,
  player shell, Pause/Settings foundations and cross-campaign continuation.
- Unified Journey, Classic, Custom and downloadable mission browsing while retaining
  original editions and ownership.
- Shared map foundations, walls, terrain, relays, directional zones, timed bonuses and
  extensive Ukrainian/FPV candidate editions through `whole-spatial-v33`.
- Localized creator/community, offline-package and company-edition foundations merged
  in v0.141.7 within their recorded automated/browser scope.
- Immutable release, selector and Pages infrastructure with preserved predecessors and
  exact release assets.

## Active batches

| Order | Batch                                                     | State                                                                                                                        | Remaining gate                                                                                                       |                                       Focused effort |
| ----: | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------: |
|     1 | v0.141.7 public acceptance                                | Published and byte-audited                                                                                                   | Finish bounded Solo package-choice/download, launch, clear/Next and offline-return checks on the frozen public build | 2–6 hours after the pending interaction is available |
|     2 | Player corrections, drafts #722 and #724                  | Failure feedback and outside-release touch recovery have focused passing checks                                              | Reconcile together or separately, exact-head qualification, release and public input/failure journeys                |                        0.5–1.5 engineering days each |
|     3 | Installed/offline inputs, PRs #726, #727 and #729         | Inventory, localization and frozen-package measurements are under qualification                                              | Related-hunk reconciliation, interruption/offline journeys, immutable release and public offline check               |                    2–4 engineering days plus devices |
|     4 | Canonical/external soundtrack successor, PR #716          | Separate owner is rebasing and correcting catalogue/player capacity                                                         | Exact-head review, focused qualification, immutable release and public streaming/offline/fallback checks             |   1–2 engineering days plus listening/network checks |
|     5 | Company/community/device inputs, PRs #721 and #723        | Company phase evidence from #725 is merged; Steam Deck and production-session work remain independently queued              | Keep evidence scopes distinct; complete each environment/device gate before any acceptance claim                     |     0.5–2 engineering days per available environment |
|     6 | Ukrainian cultural pressure triptych, draft PR #728 / v34 | Rebased onto current `main`; 126 focused tests, format, lint and validation pass locally; candidate CI passes                 | Allocate a release slot, exact-head release gates, merge, release and public mission launch; then human balance      |          0.5–1.5 engineering days plus release queue |
|     7 | Finite Remix pressure pair, stacked draft PR #730 / v35   | Rebased on the current v34 candidate; 95 focused tests, format, lint and validation pass locally                              | Admit v34, rebase onto accepted `main`, exact-head release gates, release and public Remix launch; then human balance |             0.5–1 engineering day plus release queue |

## Remaining product phases

| Priority | Work                                                          | Completion requirement                                                                                                                                           |                                Focused ETA |
| -------: | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----------------------------------------: |
|        1 | Failure/continuation and Pause/Settings/Collection acceptance | Verify the merged cumulative behaviors through complete keyboard/controller/touch journeys with exact focus and result retention; correct only demonstrated gaps |                                   1–3 days |
|        2 | Installed/offline qualification                               | Real install/update/remove, interrupted download recovery, capacity, exact bytes and offline relaunch                                                            |                      2–4 days plus devices |
|        3 | UX6 cumulative browser qualification                          | Complete Solo/Versus/Team journeys across desktop, portrait, short landscape, 200% zoom, reduced effects and offline recovery                                    |                      3–5 days plus devices |
|        4 | Actor/action/enemy and difficulty closure                     | Actual-size role readability, warnings/hits/recovery, all advertised powerups, fair early/mid/late route pressure and Team parity                                |             5–10 days plus human playtests |
|        5 | Whole-Journey spatial production                              | Continue 3–5 mission copy-on-write batches, then choose a human-approved default edition; preserve every original edition                                        |                3–7 days per polished slice |
|        6 | Team progression and presentation                             | Complementary routes, specialist clarity, recovery ownership and twelve-mission human balance                                                                    |          5–10 days plus two-player testing |
|        7 | Creator/community external acceptance                         | Live PostgreSQL/proxy/mail, two-user publication/install, private object storage, quota/corruption and browser/device checks                                     |       0.5–2 days per available environment |
|        8 | Original soundtrack production                                | Four approved pilots, then reviewed masters with rights, mix, transition and in-game listening acceptance                                                        | 2–5 days for pilots; multi-week completion |

## Blockers and concerns

1. Release mutation is serialized through one coordinator; source batches can be
   prepared in parallel, but tags, archives, selector updates and Pages cannot safely
   publish in parallel.
2. The full-suite waiver remains a waiver, not a pass. Focused behavior, source identity,
   format/lint/validation, build/provenance, immutable hashes, Pages availability and
   scoped public play remain mandatory.
3. Physical iPhone/tablet/controller/Steam Deck, speaker/listening and assistive-
   technology evidence remains incomplete.
4. Fun, fairness, retry desire, cultural accuracy and music quality require human
   review; deterministic tests do not establish them.
5. Disk space remains constrained. Do not duplicate release archives or delete unpushed
   work, user media, historical releases or another task's caches.
6. PR #716 and current production history/Team bindings have active owners; unrelated
   batches must not edit those surfaces until their exact candidate is stable.

## Batch rule

Continue in small independently playable increments:

**current accepted source → bounded related-hunk change → focused verification →
reviewed source PR → immutable release → Pages selection → public byte audit → scoped
public player check → status update.**

A branch, green test, merged PR or uploaded release is intermediate. Human/device/
external-service gates remain explicitly open until directly observed.
