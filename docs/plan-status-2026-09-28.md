# RevealLine — current completion and remaining delivery plan

Status checked **28 September 2026, 03:55 UTC** against current `main`, GitHub releases, open pull
requests, the Pages publication record and retained verification. This document
supersedes dated queue/version claims in the 27 September status while preserving that
file as historical evidence.

**Preparation update, 05:07 UTC:** the user's latest direction is to consolidate
compatible work into fewer, larger PR batches while publication is occupied. The
source plan below now uses existing PR #735 as this lane's cumulative preparation
PR, not a new PR for every sub-item. The public/version figures above remain the
last verified checkpoint, not a claim of a new deployment. GitHub GraphQL was
rate-limited during this preparation; publisher-owned receipts supersede stale
queue counts. See [research and batch scope](research/native-experience-real-world-assets-2026-09-28.md).

## Current boundary

- Current `main`: `bb9b3640270dc26633d37cfdf4a306aecda277b6` (includes PR #750).
- Published release: `v0.141.7`, frozen game source
  `efbb3882b4edd447c8e9f60ed60c536a956d78f3`.
- GitHub release and Pages publication completed; the complete current public audit
  matched **2,223 files** with no byte failures.
- Bounded public gameplay/offline acceptance is still pending. Publication and byte
  integrity do not by themselves prove the player journey.
- v0.141.7 integrates the fifty previously queued source PR inputs. Their older
  v0.141.8–v0.143.0 labels are therefore no longer authoritative implementation
  boundaries; remaining work is acceptance, correction and successor behavior.
- PR #751 prepares **v0.141.8**, the Steam Deck Confirm-on-release correction. It
  is not merged or published at this checkpoint. Its exact-head focused/build rerun
  is active; the cancelled preceding run is not a pass.
- PR #746 is the next cumulative integration, not a delivered release. Its remote
  head `1267bf01305016a5301c1beeea193f8511638b00` conflicts with newer main; its
  owner is reconciling reviewed inputs. Do not publish competing source snapshots.
- Normal Solo and Versus entry selects **`whole-spatial-v25`**, while Team selects
  **`team-cultural-specialist-originals-2`**. Later spatial editions through v33
  are available as opt-ins in the published source line. Prepared v34–v37 are not
  public. Availability of a candidate does not mean it became the default.

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

Effort below starts when the owner can work on an admitted exact source. It excludes
serialized release queue time, hosting delays and human/device availability; it is
not a promised publication time. Review it again after the next public delivery.

| Order | Batch                                             | Completed/prepared                                                                                                                                                                                         | Remaining gate                                                                                                                                                             |                                                                    Focused effort |
| ----: | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------: |
|     1 | v0.141.8 / PR #751                                | Steam Deck Confirm release-edge correction; candidate and earlier build pass                                                                                                                               | Current exact-head focused/build result, reviewed merge, immutable release, Pages and bounded public input check                                                           |                                                   2–6 hours if current gates pass |
|     2 | PR #746 cumulative integration                    | Eight source inputs: #716, #722, #723, #724, #726, #727, #728, #729; old candidate/evidence passed for the old head only                                                                                   | Reconcile newer main and bounded reviewed follow-ups, exact-head gates, one frozen release and scoped public acceptance                                                    |                                                          0.5–1.5 engineering days |
|     3 | PR #752 one-action downloadable Couch starts      | Updated candidate `dd3c85786d2dc4f914c6303859077b919db0f53a` passes candidate CI; owner reports 23 focused and 63 regression checks                                                                        | Include as the final related player-flow input, review the integrated source, then public download → selected mission and failure/retry flows                              |                                                   2–6 hours plus integration slot |
|     4 | Combined spatial/native/reference batch / PR #735 | Includes own #730/v35 and #733/v36 predecessors plus v37: eight successor missions, 85 existing v37 focused checks; new predecessor access, Studio review editions, playfield guard and licensed reference | Reconcile admitted #728/v34/main without losing accepted work, exact-head checks and one reviewed freeze; full routes and actual public play remain separate gates         | 0.5–2 engineering days for integration/qualification, plus queue and human review |
|     7 | Remaining cumulative/public acceptance            | v0.141.7 public byte audit passed; PR #750 source merged only                                                                                                                                              | Complete bounded clear/Next, retained input/results, install/offline and device journeys; preserve observed failures rather than reopening unrelated completed byte audits |                                                 1–3 engineering days plus devices |

The spatial source dependency order remains **v34 → v35 → v36 → v37**, but it does
not require four separate publications. Keep #730/#733 as recoverable source
history until the publisher admits the cumulative #735 scope and explicitly
supersedes them; do not merge them separately only to satisfy an old cadence.
The occupied/frozen release is unchanged. Prepare in parallel, then freeze a
reviewable batch rather than continuously extending the active promotion.

### Newly implemented in the combined preparation batch — not yet public

- Preserve 33 additional changed predecessor mission-editions cumulatively across
  v26–v37; latest v37 lists 81 retained prior-edition cards. No unmodified full
  campaign copies, owner changes, automatic edition-switching or progression reset.
- Expose twelve registered spatial review editions through the existing Studio
  selector/search, exact Solo/Versus links and editable full-source inspection.
  Late loading cannot overwrite a newer draft, selection or inspection. Apply
  stays explicit; existing default and originals are unchanged.
- Suppress unmodified pointer context menus only on an active owned playfield in
  Solo, both Versus boards and Team. Keyboard/assistive menus, modified gestures,
  forms, browser navigation, zoom and non-play artwork retain normal behavior.
- Bundle one 124,649-byte CC0 photograph of rafts on Synevyr Lake, with author,
  source revision and exact byte/hash provenance. Studio can explicitly load it
  as an underlay or download verified bytes. No automatic collision generation,
  publication or gameplay-background replacement is claimed.
- Add a researched artwork/source board and native-feel priorities. Museum and
  manufacturer images without suitable permission remain references, not shipped
  assets. Human enjoyment and cultural interpretation remain review gates.

The combined affected-source run passes **196/196** checks with no skips; targeted
lint/format also pass. Source tests and review close implementation defects only. Built Studio,
installed-worker, public launch and physical-device checks are still release
acceptance work, not completed by the source tests.

## Original programme: implementation versus completion

The original P00–P15 plan is **not complete**. These are the remaining acceptance
boundaries, not a proposal to rebuild already implemented engines.

| Phase   | Implemented                                                                                                                              | Still to complete                                                                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P00     | 110-mission/64-reference inventory, 48 numbered crosswalks, direct flow and progress; current-edition audit repaired in prepared PR #735 | Final dispositions for all 48 references; human capture understanding; publication of the audit repair                                                                     |
| P01–P03 | Foundations, opening/Border/Signal campaigns, Studio CRUD/image authoring, terrain and actor catalogs                                    | Meaningful return choices, timed-bonus/pacing review, authoring recovery, audiovisual and device qualification                                                             |
| P04–P07 | Neon/Rover/Fracture/Phaseworks, Remixes, erosion and pressure routes                                                                     | Frontier/escape decisions, repair usefulness, moving-threat route evidence and cleanup/short-clear review                                                                  |
| P08–P12 | Livewire/Relay/Crosswind/Sentinel/Apex mechanics and campaign editions                                                                   | Recheck current editions for unused shortcuts, inactive threats, mastery misses, warning overlap and quota tails; do not copy old defects forward without reproducing them |
| P13     | 71 core missions, 12 Remixes, 8 optional studies; library and uninterrupted progression                                                  | Whole-Journey pacing/cuts, adjacent-mission distinction, current-edition multiseed routes and a reviewed default successor                                                 |
| P14     | Twelve pictured Team missions, owned impacts, specialists and cultural successors                                                        | Complementary complete routes, rescue/support clarity, two-player and device balance                                                                                       |
| P15     | Compatibility, evidence and rollback infrastructure                                                                                      | Human sessions, cumulative accessibility/performance/offline acceptance, Legacy transition and exercised rollback                                                          |

The six FPV increments also have broad implementations: capture stop/default FPV
actors; travelling impacts and preserved Original rules; pursuit/interception and
erosion roles; directional actor/trail presentation; two skins/Tiny5; Team specialists.
Their remaining work is public/physical held-input verification, current-rule versus
Original continuity, Team front/rescue/disconnect isolation, actual-size role-state
readability, complete UI accessibility and human two-player balance. Modeled tests do
not reproduce the original physical-input report or prove fun.

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
6. The integration, Couch-download, Steam Deck and production history/Team bindings
   have active owners; unrelated batches must not edit those surfaces or reset their
   branches. New source in `main` requires a fresh integration review, not a blind
   claim that previous green evidence still covers it.
7. The older spatial idle checks use authored speeds. New route evidence must apply
   the gameplay preparation path once, record its tuning revision and separate
   first-return feasibility from full clears, signature-mechanic use and human balance.
8. The reference audit historically stopped at v6. PR #735 repairs registered-edition
   support with identical historical report hashes; local v33 and v37 audits cover
   all 48 references but still establish zero final dispositions. Source coverage
   does not close human or release acceptance.

## Batch rule

Prepare compatible, independently reviewable slices **in one cumulative PR** while
the release queue is occupied. Keep their changes logically separated for review
and rollback. Do not create a PR per sub-item or duplicate another owner's active
fix. Once admitted, stop adding scope and run one release sequence:

**current accepted source → bounded related-hunk change → focused verification →
reviewed batch PR → immutable release → Pages selection → public byte audit → scoped
public player check → status update.**

A branch, green test, merged PR or uploaded release is intermediate. Human/device/
external-service gates remain explicitly open until directly observed.
