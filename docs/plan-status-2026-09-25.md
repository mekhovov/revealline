# Reveal Line delivery status — 25 September 2026

This register is the current source of truth for the player-first delivery programme. It separates
publicly verified releases, accepted source prerequisites, qualification evidence that cannot be
published as-is, and draft work. A merge or successful workflow is not a delivered feature until
its exact cumulative source is frozen, published, admitted to the Pages selector and exercised on
the public site.

## Current boundaries

| Boundary               | Exact state                                                                                                | Meaning                                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public player release  | **v0.130.0** — [playable release](https://mekhovov.github.io/revealline/releases/v0.130.0/site/game/)      | Current Pages selector. Public Solo, Versus and Team entry, release bytes and ordinary play were verified.                                                                   |
| Public product source  | `5022108ca458e9355e9567efddfee50fb49af5c1`                                                                 | Immutable v0.130.0 product tree. Selector/archive admission merged at `1174a5bf525694c4a4679670eb7dd2b0f4bdca49`; Pages deployment `6669313494` came from run `36184029594`. |
| Accepted `main`        | `359b313e6aaeb95cf05ec73667ea2f1bacf94f29`                                                                 | Contains merged v0.131 localization, its formatting correction and the Team FPV revision-82 prerequisite. It is not yet a published release.                                 |
| Next reserved releases | **v0.131.0 localization**, then **v0.132.0 offline installed gameplay**, then **v0.133.0 compact gallery** | These are cumulative product roots. Each successor must rebase onto the last publicly accepted source and repeat its own release cycle.                                      |
| Test policy            | Long automated suites are temporarily **waived** by committed policy                                       | They were skipped, not passed. Focused regression, source, lint/format, build, provenance, frozen-asset, archive and public checks remain blocking.                          |

## Completed and public

- **Default Journey and shared player entry:** ordinary Solo and Versus expose 91 Journey missions;
  Team exposes 12 missions. Explicit Legacy access remains available.
- **Public player shell:** compact Home and Pause, direct mode entry, loading feedback, quick sound,
  global appearance foundations and direct Settings/Help access are present through v0.130.0.
- **Controller/input corrections:** public releases through v0.116.1 removed duplicate controller
  activation in the qualified paths and v0.112.0 removed the unwanted white FPV corner marks.
  This is automated and browser evidence, not physical Steam Deck certification.
- **Rewards and pictures:** v0.116.0 retains the accepted Journey picture and makes earned Solo
  rewards visible in Collection. Team artwork and exact picture authority are public through the
  v0.130 cumulative release.
- **Presentation and content consolidation:** v0.130.0 contains the accepted Ukrainian ornament,
  soundtrack, Journey spatial/pressure and creator-framework work that accumulated after v0.116.1.
  The selector, archive preservation, deployed bytes and ordinary cross-mode entry were verified.

## Accepted source prerequisites, not yet public

| Item                                   | Source state                                                                                                                                                                                                               | Remaining work                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team FPV revision-82 picture authority | PR [#540](https://github.com/mekhovov/revealline/pull/540), merge `cd92ce1d26b9df915d04975f9a7eb83c4c5750ff`                                                                                                               | Included in current `main`, but not in public v0.130. It must travel with v0.131 and every later cumulative release. Focused binding/import evidence passed 38/38; physical/browser qualification remains part of the release that exposes it.                                                                                                                    |
| Release-order restoration              | PR [#544](https://github.com/mekhovov/revealline/pull/544), merge `7bee9bb35ba99b007ab55f3890e3602bea9aa75d`                                                                                                               | Complete. It preserved history and removed the v0.133 source from active `main` until v0.131 and v0.132 are accepted. It did not publish or delete gallery work.                                                                                                                                                                                                  |
| v0.131 localization source             | PR [#506](https://github.com/mekhovov/revealline/pull/506), merge `d3e5ef4e9218ec79a3fbe72c71c02db3c719866c`; PR [#550](https://github.com/mekhovov/revealline/pull/550), merge `359b313e6aaeb95cf05ec73667ea2f1bacf94f29` | Localization and its mechanical formatting correction are merged. PR #550's policy gate passed preflight and release-ready; long tests and the build job were skipped under the temporary policy, not passed. Publication still requires the fixture correction, exact-source qualification, freeze, release, archive/selector admission and public verification. |

## Qualified evidence only

The compact-gallery merge source `54fbbe52c1622d0e3b0a6a148508b6ea507bdec5` completed exact-source
qualification in run [36187128651](https://github.com/mekhovov/revealline/actions/runs/36187128651).
That result is **evidence only**:

- PR [#535](https://github.com/mekhovov/revealline/pull/535) had merged v0.133.0 before the still-open
  v0.131 and v0.132 product roots.
- PR #544 reverted that merge while preserving all commits and review history.
- The frozen/qualified `54fbbe52` source must not be tagged, selected or published because it does
  not contain the future accepted v0.131 and v0.132 cumulative product roots.
- After both predecessors are public, the gallery must be reapplied or reconciled onto their exact
  successor source, re-versioned as v0.133.0, and qualified again. Earlier passing evidence reduces
  implementation risk but does not qualify the reconciled release.

## In progress and draft queue

| Planned release / phase                       | Current work                                                                                                                                                                                          | Status and dependency                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v0.131.0 — localization**                   | merged PRs [#506](https://github.com/mekhovov/revealline/pull/506) and [#550](https://github.com/mekhovov/revealline/pull/550); correction PR [#551](https://github.com/mekhovov/revealline/pull/551) | Product source is merged but unpublished. Merged-source qualification exposed stale Team fixture hashes after support-role state became explicit. PR #551 refreshes the 19 intentional hashes; its focused 43/43 and policy preflight/release-ready checks pass, while long tests and build are skipped. Merge #551, rerun exact cumulative qualification, freeze, publish, archive v0.130, deploy and verify public EN/UA behavior.                                               |
| **v0.132.0 — offline installed gameplay**     | PR [#536](https://github.com/mekhovov/revealline/pull/536)                                                                                                                                            | Draft and currently conflicting with `main`. Reconcile only after public v0.131 acceptance. Re-run integrity/storage/build checks against localized output, then complete cold-install/update/recovery evidence. Prior 281 focused tests remain branch evidence only.                                                                                                                                                                                                              |
| **v0.133.0 — compact mission gallery**        | preserved PR [#535](https://github.com/mekhovov/revealline/pull/535) commits                                                                                                                          | Temporarily reverted. Reapply after public v0.132, resolve cumulative conflicts, repeat focused inventory/input/browser checks, then run a fresh exact-source release cycle.                                                                                                                                                                                                                                                                                                       |
| **v0.134.0 — Couch secondary navigation**     | draft PR [#539](https://github.com/mekhovov/revealline/pull/539)                                                                                                                                      | Based on older source and dependent on the gallery controller ownership. Rebase after public v0.133, remove duplicate overlap, and close the remaining controller lifecycle case.                                                                                                                                                                                                                                                                                                  |
| **UX3 — contextual Team teaching**            | draft PR [#543](https://github.com/mekhovov/revealline/pull/543)                                                                                                                                      | Focused 5/5 evidence for cut, Support and rescue cues. It was based on the now-reverted gallery source, so it needs reconciliation after v0.134 and real-event browser review in portrait and short landscape.                                                                                                                                                                                                                                                                     |
| **UX4 — deliberate terminal retry**           | draft PR [#545](https://github.com/mekhovov/revealline/pull/545)                                                                                                                                      | Removes Team's automatic terminal restart and waits for deliberate input. Focused Team/Skip/Solo cases passed. Rebase after the gallery/input owner; retain stopped-result and held-Confirm proof. This narrow safety correction may ship before the broader UX3 package if its dependency audit remains clean.                                                                                                                                                                    |
| **UX5 — Pause Settings/Help return**          | draft PR [#542](https://github.com/mekhovov/revealline/pull/542)                                                                                                                                      | Focused return-flow checks pass, while the broader modal file still has five inherited Collection/Studio failures. Reconcile after v0.134 and preserve exact opener/checkpoint behavior. Its current v0.135 milestone conflicts with the stated UX3-before-UX5 programme and must be reallocated before promotion.                                                                                                                                                                 |
| **Test prerequisite — Collection disclosure** | draft PR [#548](https://github.com/mekhovov/revealline/pull/548)                                                                                                                                      | Test-boundary correction for duplicate `<summary>` toggling; focused Collection navigation passed 8/8. It changes no runtime behavior and must be reconciled where the Collection flow first needs it, rather than consuming a player release slot.                                                                                                                                                                                                                                |
| **UX2 — Team quick start**                    | draft PR [#549](https://github.com/mekhovov/revealline/pull/549)                                                                                                                                      | Moves Arena and team tuning into optional controls so valid defaults can start directly. Focused keyboard and responsive checks passed 4/4. Four broader controller cases depend on the reverted gallery ownership guard; rebase after v0.133 and reconcile its `relay-rescue.mjs` overlap with PR #539.                                                                                                                                                                           |
| **UX4 — Versus start countdown**              | draft PR [#552](https://github.com/mekhovov/revealline/pull/552)                                                                                                                                      | Adds localized 3-2-1-Go for new races and Ready-Go for Retry; simulations remain at tick zero until Go and held input is cleared. Exact-head focused evidence passed 5/5 cue tests, 10/10 continuous-Next tests, localization catalog generation, scoped lint/format and diff checks. Its policy run passed preflight, then release-ready correctly held the unversioned draft; build and long tests were skipped, not passed. Reconcile after v0.133 before allocating a release. |

Drafts are implementation inputs. Their green focused checks do not authorize merge or public claims
until they are rebased onto the accepted predecessor and pass the exact-head release gates.

## Remaining player-first programme and elapsed ETA

Ranges begin when the item becomes the sole active release candidate. They include ordinary review,
focused correction and one clean release cycle. GitHub runner, large-asset upload and archive delays
can extend them. Hardware-dependent acceptance is called out separately.

| Order | Item                                   | Blocking acceptance                                                                                                                                                                  |                                                                          Working elapsed ETA |
| ----: | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------: |
|     1 | **v0.131 localization closure**        | Merge the verified fixture correction; rerun exact-source qualification; freeze, publish, archive/admit, deploy and verify the public bilingual player paths                         |    **2–8 hours** for the release pipeline; physical-device bilingual review remains separate |
|     2 | **v0.132 offline installed gameplay**  | Rebase onto public v0.131; integrity-checked install/update/remove/recovery; localized bundle/storage measurements; exact freeze and public offline launch                           | **1–3 days**, plus **1–3 days** for Android/iPhone/iPad/Safari/desktop cold-install coverage |
|     3 | **v0.133 compact mission gallery**     | Reapply onto public v0.132; preserve full inventories, one-action activation, bounded previews and guarded Confirm; repeat exact qualification and public play                       |                                     **8–16 hours**, plus physical controller/touch follow-up |
|     4 | **v0.134 Couch secondary navigation**  | Reconcile PR #539, collapse gallery overlap, expose secondary destinations consistently and restore exact opener/focus                                                               |                                                                               **6–12 hours** |
|     5 | **UX4 terminal retry safety slice**    | Reconcile PR #545; no auto-restart, held-input carry-through, stale result loss or picture/setup mutation                                                                            |                                        **4–8 hours**; physical controller follow-up separate |
|     6 | **UX2/UX3 quick start and teaching**   | Reconcile PRs #549/#543 after navigation ownership lands; direct valid-default start, board/HUD/touch coexistence, contextual cut/Support/rescue teaching and reduced-effects parity |                                                             **1–2 days**, plus hardware play |
|     7 | **UX4 continuation remainder**         | Reconcile PR #552 countdown/Retry cue, then add named successors, campaign endings and duplicate-award proof                                                                         |                                                                                 **1–2 days** |
|     8 | **UX5 player screens**                 | Reconcile PR #542; Settings/difficulty, Help, Collection/Records/replay, recovery and exact return focus                                                                             |                                                                                 **1–2 days** |
|     9 | **UX6 whole-player qualification**     | End-to-end Solo/Versus/Team journeys, accessibility, performance, storage, offline, lifecycle and mixed-input coverage                                                               |                                                       **2–4 days**, plus device availability |
|    10 | **P08 map/actor/action closure**       | All 15 Versus maps, both Team arenas/imports, full role/effect inventory and reduced-effects readability                                                                             |                                                                 **2–4 days**, plus playtests |
|    11 | **P02/P05 audio and themes**           | One audio authority, complete theme compatibility/restoration, transfer/offline behavior and actual listening review                                                                 |                                                                                 **2–4 days** |
|    12 | **P04/P17 Studio/community authoring** | Cross-mode previews, upload/edit/history/bundle round trips and an independent create/install/play/recover trial                                                                     |                                                                                 **4–7 days** |
|    13 | **P09/P10 encounters and difficulty**  | Gentle/Standard/Hard, deterministic optional encounters, readable counterplay and 36-case Team matrix                                                                                |                                                   **3–6 days**, plus human balance playtests |
|    14 | **P11–P15 campaign production**        | FPV, DroneAid, Living Atlas, Retro and Coupa slices with design cards, reviewed art and independent releases                                                                         |                                                              **3–7 days per accepted slice** |

The ETA is not a promise that all work can proceed concurrently. Feature preparation may run in
isolated branches, but tags, frozen assets, archive admission and Pages deployment must remain
serialized under one publisher.

## Dependency order and release-slot correction

1. Finish and publicly accept v0.131 before rebasing v0.132.
2. Finish and publicly accept v0.132 before reapplying the compact gallery as v0.133.
3. Rebase PR #539 after public v0.133; it owns the remaining Couch secondary-navigation slice.
4. Reconcile the unversioned quick-start and countdown drafts only after their shared gallery/input
   owner is public. PR #549 overlaps PR #539 in `relay-rescue.mjs`; PR #552 is intentionally held by
   release-ready because it has no allocated version. Preserve their focused evidence, but qualify
   the future cumulative heads from scratch.
5. Allocate post-v0.134 versions only after dependency review. Draft titles currently stage Team
   teaching, deliberate terminal retry and Pause return as v0.135-v0.137, but ordering remains
   conditional on clean rebases. Do not promote by version number alone.
6. Keep creator/admin, bulk campaign and unrelated visual work draft until the player-critical chain
   is accepted. Do not combine unrelated drafts to fill a release.

## Blockers and concerns

1. **Disk pressure:** the development volume has been near full. New worktrees, builds and frozen
   artifacts can fail mid-operation. Prefer sparse worktrees, avoid duplicate artifacts and retire
   only proven disposable caches.
2. **Temporary long-suite waiver:** full automated matrices are skipped by policy, not green. This
   increases integration risk in the broad localization/offline roots. Restore full CI before UX6
   final qualification.
3. **Physical hardware is not certified:** modeled controller checks and browser pointer clicks do
   not prove Steam Deck, DualSense, iPhone, iPad or tablet behavior. The same applies to 200% zoom,
   safe areas, rotation and reconnect under real device timing.
4. **Human review remains open:** mission fairness, addictive pacing, cultural accuracy, actor
   readability and soundtrack quality require play/listening review and cannot be inferred from
   deterministic tests.
5. **Large cumulative roots:** localization touches hundreds of files; offline installation changes
   content ownership and storage. Each must be reviewed as a cumulative product root, not merged
   merely because an older branch was green.
6. **Draft dependency drift:** PRs #539, #542, #543, #545, #548, #549 and #552 were created from
   different points around the reverted gallery merge. PR #536 is already conflicting with current
   `main`. Rebase and collapse overlaps in release order; never bulk merge the queue.
7. **Release serialization:** only one publisher may own version metadata, tags, frozen assets,
   archive slots and Pages. Parallel implementation cannot make public releases parallel.
8. **Offline footprint:** v0.130 core was within the accepted budget, but localization and offline
   catalogues can change file counts and byte totals. Re-measure emitted artifacts for every root.
9. **Evidence boundary:** the v0.133 `54fbbe52` qualification is valid historical evidence, not a
   substitute for qualifying the future cumulative v0.133 source.
10. **v0.131 release closure:** the localization product is merged, but the public selector remains
    v0.130. PR #550's gate does not replace exact merged-source qualification. PR #551 and the full
    freeze/archive/Pages/public sequence remain blocking before v0.132 may be reconciled.

## Completion rule

Every player-facing release follows:

**rebase latest publicly accepted predecessor → implement/reconcile related hunks → focused tests and
browser proof → versioned PR → protected merge → exact-source qualification → immutable
freeze/release → predecessor archive → Pages selector/deploy → public byte and scoped-play
verification → status update.**

A branch, passing focused test, merged PR, workflow, tag or deployment is intermediate. “Complete”
means the public version was verified, with waived suites, physical-device limits and human-review
limits stated explicitly.
