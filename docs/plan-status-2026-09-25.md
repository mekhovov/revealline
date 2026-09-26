# Reveal Line delivery status — 26 September 2026

This register is the current source of truth for the player-first delivery programme. It separates
publicly verified releases, accepted source prerequisites, qualification evidence that cannot be
published as-is, and draft work. A merge or successful workflow is not a delivered feature until
its exact cumulative source is frozen, published, admitted to the Pages selector and exercised on
the public site.

## Current boundaries

| Boundary               | Exact state                                                                                                | Meaning                                                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public player release  | **v0.130.0** — [playable release](https://mekhovov.github.io/revealline/releases/v0.130.0/site/game/)      | Current Pages selector. Public Solo, Versus and Team entry, release bytes and ordinary play were verified.                                                                                                       |
| Public product source  | `5022108ca458e9355e9567efddfee50fb49af5c1`                                                                 | Immutable v0.130.0 product tree. Selector/archive admission merged at `1174a5bf525694c4a4679670eb7dd2b0f4bdca49`; Pages deployment `6669313494` came from run `36184029594`.                                     |
| Accepted `main`        | **v0.131.0 source** `a63ad4cc32fb14c53fa126d69df42e2e53d1477d`                                             | Includes the revision-84 Team binding and live-switchable Couch cancellation correction. Replacement exact-source qualification, freeze and frozen-artifact inspection passed; immutable publication is pending. |
| Next reserved releases | **v0.131.0 localization**, then **v0.132.0 offline installed gameplay**, then **v0.133.0 compact gallery** | These are cumulative product roots. Each successor must rebase onto the last publicly accepted source and repeat its own release cycle.                                                                          |
| Test policy            | Long automated suites are temporarily **waived** by committed policy                                       | They were skipped, not passed. Focused regression, source, lint/format, build, provenance, frozen-asset, archive and public checks remain blocking.                                                              |

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

## Accepted source, not yet public

| Item                                   | Source state                                                                                                                                          | Remaining work                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team FPV revision-84 picture authority | PR [#566](https://github.com/mekhovov/revealline/pull/566), merge `a63ad4cc32fb14c53fa126d69df42e2e53d1477d`                                          | Current starter and historical-import bindings now match FPV revision 84 while retaining 58–83. Direct binding contracts pass 94/94 and temporary PR #549 host composition passes 3/3. Public/browser qualification remains part of the release.                                                                                                                      |
| v0.131 localization product root       | PRs [#506](https://github.com/mekhovov/revealline/pull/506) and [#566](https://github.com/mekhovov/revealline/pull/566); cumulative `main` `a63ad4cc` | Replacement run [36204532882](https://github.com/mekhovov/revealline/actions/runs/36204532882) passed required source gates and freeze. Artifact inspection run [36205038007](https://github.com/mekhovov/revealline/actions/runs/36205038007) passed. Long suites were skipped under policy. Upload, publication, archive admission, Pages and public checks remain. |
| Freeze dependency repair               | PR [#563](https://github.com/mekhovov/revealline/pull/563), merge `e11bf150fa7b6201a17ca6e4e51a0623b4eb88b4`                                          | Installs lockfile dependencies before freeze. The replacement exact-source run passed, resolving the earlier missing-`lz-string` failure.                                                                                                                                                                                                                             |

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

| Planned release / phase                       | Current work                                                                                                                                                                                                          | Status and dependency                                                                                                                                                                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v0.131.0 — localization**                   | cumulative source `a63ad4cc`; qualification [36204532882](https://github.com/mekhovov/revealline/actions/runs/36204532882); inspection [36205038007](https://github.com/mekhovov/revealline/actions/runs/36205038007) | Corrected source gates, freeze and frozen-artifact inspection pass. Upload frozen originals, publish, archive/admit, deploy and verify public EN/UA plus Legacy Team start.                                                                                           |
| **v0.132.0 — offline installed gameplay**     | PR [#536](https://github.com/mekhovov/revealline/pull/536)                                                                                                                                                            | Draft and currently conflicting with `main`. Reconcile only after public v0.131 acceptance. Re-run integrity/storage/build checks against localized output, then complete cold-install/update/recovery evidence. Prior 281 focused tests remain branch evidence only. |
| **v0.133.0 — compact mission gallery**        | preserved PR [#535](https://github.com/mekhovov/revealline/pull/535) commits                                                                                                                                          | Temporarily reverted. Reapply after public v0.132, resolve cumulative conflicts, repeat focused inventory/input/browser checks, then run a fresh exact-source release cycle.                                                                                          |
| **UX2 — Team quick start**                    | draft PR [#549](https://github.com/mekhovov/revealline/pull/549), exact head `ce9ef1e2`                                                                                                                               | Rebased onto the prior candidate; structural checks pass and a temporary composition with PR #566 proves the three previously blocked keyboard, touch and controller-preparation journeys. Rebase onto the accepted cumulative predecessor again before promotion.    |
| **UX2 — Couch secondary navigation**          | draft PR [#539](https://github.com/mekhovov/revealline/pull/539)                                                                                                                                                      | Reconcile after the cumulative gallery and PR #549 quick-start owner, remove duplicate overlap, and close the remaining controller lifecycle case.                                                                                                                    |
| **UX3 — contextual Team teaching**            | draft PR [#543](https://github.com/mekhovov/revealline/pull/543)                                                                                                                                                      | Focused 5/5 evidence for cut, Support and rescue cues. It was based on the now-reverted gallery source, so it needs reconciliation after v0.134 and real-event browser review in portrait and short landscape.                                                        |
| **UX4 — deliberate terminal retry**           | draft PR [#545](https://github.com/mekhovov/revealline/pull/545), exact head `459c1acb`                                                                                                                               | Rebased onto current main. Team terminal recovery 3/3, Team Skip 1/1 and Solo terminal self-contact 1/1 pass with scoped static checks. Final release still follows gallery/input ownership and physical-controller review.                                           |
| **UX5 — Pause Settings/Help return**          | draft PR [#542](https://github.com/mekhovov/revealline/pull/542), exact head `38c9502c`                                                                                                                               | Rebased onto current main. Focused pause/modal return 20/20 evidence plus scoped lint/format pass. Carry after earlier UX2–UX4 owners and preserve exact opener/checkpoint behavior.                                                                                  |
| **Test prerequisite — Collection disclosure** | draft PR [#548](https://github.com/mekhovov/revealline/pull/548), exact head `c0cbd441`                                                                                                                               | Rebased test-boundary correction for duplicate `<summary>` toggling; focused Collection disclosure/appearance/return checks pass 7/7. It changes no runtime behavior and should travel with PR #542 rather than consuming a player release slot.                      |
| **UX4 — Versus start countdown**              | draft PR [#552](https://github.com/mekhovov/revealline/pull/552), exact head `593502f8`                                                                                                                               | Rebased onto current main. Focused cue and continuous-Next evidence passes 15/15; localization, lint/format and preflight pass. Draft admission correctly prevents release until its cumulative slot is allocated.                                                    |
| **UX4 — named result destinations**           | draft PR [#557](https://github.com/mekhovov/revealline/pull/557), exact head `46cbec56`                                                                                                                               | Rebased onto current main. Result policy 2/2, Solo 3/3 and Versus 1/1 pass. Reconcile after the countdown/result owner, then add campaign-ending and duplicate-award proof.                                                                                           |

Drafts are implementation inputs. Their green focused checks do not authorize merge or public claims
until they are rebased onto the accepted predecessor and pass the exact-head release gates.

## Remaining player-first programme and elapsed ETA

Ranges begin when the item becomes the sole active release candidate. They include ordinary review,
focused correction and one clean release cycle. GitHub runner, large-asset upload and archive delays
can extend them. Hardware-dependent acceptance is called out separately.

| Order | Item                                   | Blocking acceptance                                                                                                                                            |                                                                                 Working elapsed ETA |
| ----: | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------: |
|     1 | **v0.131 localization closure**        | Upload the inspected frozen originals, publish, archive/admit, deploy and verify bilingual plus Legacy Team player paths                                       | **1–6 hours** for the remaining release pipeline; physical-device bilingual review remains separate |
|     2 | **v0.132 offline installed gameplay**  | Rebase onto public v0.131; integrity-checked install/update/remove/recovery; localized bundle/storage measurements; exact freeze and public offline launch     |        **1–3 days**, plus **1–3 days** for Android/iPhone/iPad/Safari/desktop cold-install coverage |
|     3 | **v0.133 compact mission gallery**     | Reapply onto public v0.132; preserve full inventories, one-action activation, bounded previews and guarded Confirm; repeat exact qualification and public play |                                            **8–16 hours**, plus physical controller/touch follow-up |
|     4 | **UX2 Team quick start**               | Reconcile PR #549 first; valid defaults start directly, optional tuning remains available, and preparation/cancel has one input owner                          |                                                                                      **6–12 hours** |
|     5 | **UX2 Couch secondary navigation**     | Reconcile PR #539 after quick-start ownership, collapse overlap, expose secondary destinations consistently and restore exact opener/focus                     |                                                                                      **6–12 hours** |
|     6 | **UX4 terminal retry safety slice**    | Reconcile PR #545; no auto-restart, held-input carry-through, stale result loss or picture/setup mutation                                                      |                                               **4–8 hours**; physical controller follow-up separate |
|     7 | **UX3 gameplay layout and teaching**   | Reconcile PR #543; board/HUD/touch coexistence, contextual cut/Support/rescue teaching and reduced-effects parity                                              |                                                                    **1–2 days**, plus hardware play |
|     8 | **UX4 continuation remainder**         | Reconcile PR #552 countdown/Retry cue, then PR #557 named successors; add campaign endings and duplicate-award proof                                           |                                                                                        **1–2 days** |
|     9 | **UX5 player screens**                 | Carry PRs #542/#548; finish difficulty, Collection/Records/replay, recovery and exact return focus                                                             |                                                                                        **1–2 days** |
|    10 | **UX6 whole-player qualification**     | End-to-end Solo/Versus/Team journeys, accessibility, performance, storage, offline, lifecycle and mixed-input coverage                                         |                                                              **2–4 days**, plus device availability |
|    11 | **P08 map/actor/action closure**       | All 15 Versus maps, both Team arenas/imports, full role/effect inventory and reduced-effects readability                                                       |                                                                        **2–4 days**, plus playtests |
|    12 | **P02/P05 audio and themes**           | One audio authority, complete theme compatibility/restoration, transfer/offline behavior and actual listening review                                           |                                                                                        **2–4 days** |
|    13 | **P04/P17 Studio/community authoring** | Cross-mode previews, upload/edit/history/bundle round trips and an independent create/install/play/recover trial                                               |                                                                                        **4–7 days** |
|    14 | **P09/P10 encounters and difficulty**  | Gentle/Standard/Hard, deterministic optional encounters, readable counterplay and 36-case Team matrix                                                          |                                                          **3–6 days**, plus human balance playtests |
|    15 | **P11–P15 campaign production**        | FPV, DroneAid, Living Atlas, Retro and Coupa slices with design cards, reviewed art and independent releases                                                   |                                                                     **3–7 days per accepted slice** |

The ETA is not a promise that all work can proceed concurrently. Feature preparation may run in
isolated branches, but tags, frozen assets, archive admission and Pages deployment must remain
serialized under one publisher.

## Dependency order and release-slot correction

1. Finish and publicly accept v0.131 before rebasing v0.132.
2. Finish and publicly accept v0.132 before reapplying the compact gallery as v0.133.
3. Reconcile PR #549 after public v0.133 so Team quick-start establishes the final Start/preparation
   ownership before secondary navigation edits the same host.
4. Reconcile PR #539 on top of that quick-start source and collapse its `relay-rescue.mjs` overlap.
5. Reconcile deliberate terminal retry before broader teaching and result continuation. Preserve
   the rebased PR #552/#557 evidence, but qualify their future cumulative heads from scratch.
6. Carry rebased PRs #542/#548 together in UX5; the test-only fixture must not consume a release slot.
7. Allocate versions only when each cumulative predecessor is public. Do not promote by an old draft
   title or reserved version number.
8. Keep creator/admin, bulk campaign and unrelated visual work draft until the player-critical chain
   is accepted. Do not combine unrelated drafts to fill a release.

## Blockers and concerns

1. **Disk pressure:** the development volume had about 2.1 GiB free at this update. New worktrees, builds and frozen
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
6. **Draft dependency drift:** PRs #542, #548, #552 and #557 are now one commit over current `main`,
   but their final cumulative release sources still depend on v0.132/v0.133 and earlier UX owners.
   PRs #536, #539, #543, #545 and #549 still require ordered reconciliation. Never bulk merge the queue.
7. **Release serialization:** only one publisher may own version metadata, tags, frozen assets,
   archive slots and Pages. Parallel implementation cannot make public releases parallel.
8. **Offline footprint:** v0.130 core was within the accepted budget, but localization and offline
   catalogues can change file counts and byte totals. Re-measure emitted artifacts for every root.
9. **Evidence boundary:** the v0.133 `54fbbe52` qualification is valid historical evidence, not a
   substitute for qualifying the future cumulative v0.133 source.
10. **v0.131 release closure:** the corrected `a63ad4cc` source passed exact-source qualification,
    freeze and frozen-artifact inspection. Upload, immutable publication, archive/Pages admission and
    public EN/UA plus Legacy Team verification remain blocking before v0.132 may be reconciled.

## Completion rule

Every player-facing release follows:

**rebase latest publicly accepted predecessor → implement/reconcile related hunks → focused tests and
browser proof → versioned PR → protected merge → exact-source qualification → immutable
freeze/release → predecessor archive → Pages selector/deploy → public byte and scoped-play
verification → status update.**

A branch, passing focused test, merged PR, workflow, tag or deployment is intermediate. “Complete”
means the public version was verified, with waived suites, physical-device limits and human-review
limits stated explicitly.
