# Reveal Line delivery status — 26 September 2026

This register is the current source of truth for the player-first delivery programme. It separates
publicly verified releases, accepted source prerequisites, qualification evidence that cannot be
published as-is, and draft work. A merge or successful workflow is not a delivered feature until
its exact cumulative source is frozen, published, admitted to the Pages selector and exercised on
the public site.

## Current boundaries

| Boundary                | Exact state                                                                                           | Meaning                                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public player release   | **v0.131.0** — [playable release](https://mekhovov.github.io/revealline/releases/v0.131.0/site/game/) | Current Pages selector. Archive87 admission, deployed bytes and ordinary Solo, Versus and Team entry were independently verified in English and Ukrainian, including Legacy Team entry.                        |
| Public product source   | `a63ad4cc32fb14c53fa126d69df42e2e53d1477d`                                                            | Immutable v0.131.0 product tree. The selector/archive merge is `23e6129782e08ed826686f137a0989e5f154732a`; Pages run [36207322888](https://github.com/mekhovov/revealline/actions/runs/36207322888) succeeded. |
| Accepted `main`         | `140be31c5cb3c4f50947f0fb0f9288a3ad1dc18b`                                                            | Contains cumulative v0.132 product merge `104b168c` plus PR #581 publishing automation. It is not public until exact-source qualification, freeze, immutable release and Pages admission finish.               |
| Next release allocation | **v0.132.0 publication** from exact main `140be31c`, then compact gallery as v0.133.0                 | Complete source/build/provenance qualification, immutable freeze/release, archive admission, Pages deployment and public offline verification before advancing.                                                |
| Test policy             | Long automated suites are temporarily **waived** by committed policy                                  | They were skipped, not passed. Focused regression, source, lint/format, build, provenance, frozen-asset, archive and public checks remain blocking.                                                            |

## Completed and public

- **Default Journey and shared player entry:** ordinary Solo and Versus expose 91 Journey missions;
  Team exposes 12 missions. Explicit Legacy access remains available.
- **Public player shell:** compact Home and Pause, direct mode entry, loading feedback, quick sound,
  global appearance foundations and direct Settings/Help access are present through v0.131.0.
- **Controller/input corrections:** public releases through v0.116.1 removed duplicate controller
  activation in the qualified paths and v0.112.0 removed the unwanted white FPV corner marks.
  This is automated and browser evidence, not physical Steam Deck certification.
- **Rewards and pictures:** v0.116.0 retains the accepted Journey picture and makes earned Solo
  rewards visible in Collection. Team artwork and exact revision-84 picture authority are public
  through v0.131.0.
- **Presentation and content consolidation:** v0.130.0 contains the accepted Ukrainian ornament,
  soundtrack, Journey spatial/pressure and creator-framework work that accumulated after v0.116.1.
  The selector, archive preservation, deployed bytes and ordinary cross-mode entry were verified.
- **Localized cumulative player release:** v0.131.0 is public from immutable product source
  `a63ad4cc`. PR #566 aligns current Team FPV bindings with revision 84 while retaining historical
  revisions 58–83 and keeps Couch continuation cancellation localized and live-switchable. Archive87,
  Pages run 36207322888 and independent public English/Ukrainian Solo, Versus, Team and Legacy Team
  entry checks are complete.

## Latest accepted source and release evidence

| Item                                   | Exact accepted evidence                                                                                                                                                                                                                                                | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.131 localization product root       | PRs [#506](https://github.com/mekhovov/revealline/pull/506) and [#566](https://github.com/mekhovov/revealline/pull/566); source `a63ad4cc32fb14c53fa126d69df42e2e53d1477d`; immutable [v0.131.0 release](https://github.com/mekhovov/revealline/releases/tag/v0.131.0) | Qualification/freeze [36204532882](https://github.com/mekhovov/revealline/actions/runs/36204532882), artifact inspection [36205038007](https://github.com/mekhovov/revealline/actions/runs/36205038007), evidence assembly [36205454953](https://github.com/mekhovov/revealline/actions/runs/36205454953), Archive87 admission and Pages [36207322888](https://github.com/mekhovov/revealline/actions/runs/36207322888) passed. All nine release assets are published. Long suites were skipped under policy. |
| Team FPV revision-84 picture authority | PR [#566](https://github.com/mekhovov/revealline/pull/566), included in `a63ad4cc`                                                                                                                                                                                     | Current starter and historical-import bindings match FPV revision 84 while retaining 58–83. Binding contracts passed 94/94; public EN/UA Team and Legacy Team entry were independently verified.                                                                                                                                                                                                                                                                                                              |
| Publication boundary                   | selector/archive merge `23e6129782e08ed826686f137a0989e5f154732a`                                                                                                                                                                                                      | `main` contains publication metadata over the immutable `a63ad4cc` product source; no later gameplay source is public yet.                                                                                                                                                                                                                                                                                                                                                                                    |

## Qualified evidence only

The compact-gallery merge source `54fbbe52c1622d0e3b0a6a148508b6ea507bdec5` completed exact-source
qualification in run [36187128651](https://github.com/mekhovov/revealline/actions/runs/36187128651).
That result is **evidence only**:

- PR [#535](https://github.com/mekhovov/revealline/pull/535) had merged v0.133.0 before the then-open
  v0.131 and offline product roots.
- PR #544 reverted that merge while preserving all commits and review history.
- The frozen/qualified `54fbbe52` source must not be tagged, selected or published because it does
  not contain the accepted v0.131 root or the future offline/selector-localization successor.
- After its cumulative predecessors are public, the gallery must be reapplied or reconciled onto
  their exact successor source, assigned the next unused version, and qualified again. Earlier passing evidence reduces
  implementation risk but does not qualify the reconciled release.

## In progress and draft queue

| Planned release / phase                           | Current work                                                                                                            | Status and dependency                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **v0.132.0 — offline installed gameplay**         | merged PR [#536](https://github.com/mekhovov/revealline/pull/536), merge `104b168c`                                     | Source complete. The exact rebased head retained stable non-generated patch ID `40b99010`; its sole generated-catalog conflict was rebuilt from 9,529 messages. Exact-head preflight/release-ready/assemble passed; merged-source qualification and publication remain.                                                                          |
| **v0.132.0 — website selector localization**      | merged PR [#573](https://github.com/mekhovov/revealline/pull/573), merge `e05720c1`                                     | Complete. The real-catalog About-host EN↔UA↔EN test preserves focus, release/pack/campaign/level identity and Play href; focused host checks pass 6/6 and exact-head hosted admission passed.                                                                                                                                                  |
| **v0.132.0 — pack/Journey error localization**    | merged PR [#576](https://github.com/mekhovov/revealline/pull/576), merge `2e5db3a2`                                     | Complete. Rebased after PR #573 with the cumulative catalogue regenerated from source; structural errors follow the active locale and cumulative focused checks pass 49/49 with exact-head hosted admission.                                                                                                                                     |
| **Compact mission gallery — version unallocated** | preserved PR [#535](https://github.com/mekhovov/revealline/pull/535) commits                                            | Temporarily reverted. Reapply after the accepted offline/selector-localization predecessor sequence, resolve cumulative conflicts, repeat focused inventory/input/browser checks, then run a fresh exact-source release cycle.                                                                                                                   |
| **UX2 — Team quick start**                        | draft PR [#549](https://github.com/mekhovov/revealline/pull/549), exact head `59d40ae82b38d124830ba6119a036423483930a4` | Rebased onto accepted selector merge `23e61297`; stable patch ID matches the previously tested head exactly. Quick-start parity passes 9/9 and keyboard navigation 1/1; hosted preflight/release-ready pass while long jobs remain skipped. Rebase onto the accepted cumulative predecessor again before promotion.                              |
| **UX2 — Couch secondary navigation**              | draft PR [#539](https://github.com/mekhovov/revealline/pull/539); stacked safety commit `f5c7be05`                      | Reconcile after the cumulative gallery and PR #549 quick-start owner, remove duplicate overlap, and close the remaining controller lifecycle case. The stacked safety correction is preserved, but its full focused checks did not complete before disk exhaustion interrupted the run; it is implementation evidence, not qualified acceptance. |
| **UX3 — contextual Team teaching**                | draft PR [#543](https://github.com/mekhovov/revealline/pull/543)                                                        | Focused 5/5 evidence for cut, Support and rescue cues. It needs reconciliation after the preceding cumulative UX owners and real-event browser review in portrait and short landscape.                                                                                                                                                           |
| **UX4 — deliberate terminal retry**               | draft PR [#545](https://github.com/mekhovov/revealline/pull/545), exact head `459c1acb`                                 | Rebased onto current main. Team terminal recovery 3/3, Team Skip 1/1 and Solo terminal self-contact 1/1 pass with scoped static checks. Final release still follows gallery/input ownership and physical-controller review.                                                                                                                      |
| **UX5 — Pause Settings/Help return**              | draft PR [#542](https://github.com/mekhovov/revealline/pull/542), exact head `38c9502c`                                 | Rebased onto current main. Focused pause/modal return 20/20 evidence plus scoped lint/format pass. Carry after earlier UX2–UX4 owners and preserve exact opener/checkpoint behavior.                                                                                                                                                             |
| **Test prerequisite — Collection disclosure**     | draft PR [#548](https://github.com/mekhovov/revealline/pull/548), exact head `c0cbd441`                                 | Rebased test-boundary correction for duplicate `<summary>` toggling; focused Collection disclosure/appearance/return checks pass 7/7. It changes no runtime behavior and should travel with PR #542 rather than consuming a player release slot.                                                                                                 |
| **UX4 — Versus start countdown**                  | draft PR [#552](https://github.com/mekhovov/revealline/pull/552), exact head `593502f8`                                 | Rebased onto current main. Focused cue and continuous-Next evidence passes 15/15; localization, lint/format and preflight pass. Draft admission correctly prevents release until its cumulative slot is allocated.                                                                                                                               |
| **UX4 — named result destinations**               | draft PR [#557](https://github.com/mekhovov/revealline/pull/557), exact head `46cbec56`                                 | Rebased onto current main. Result policy 2/2, Solo 3/3 and Versus 1/1 pass. Reconcile after the countdown/result owner, then add campaign-ending and duplicate-award proof.                                                                                                                                                                      |

Drafts are implementation inputs. Their green focused checks do not authorize merge or public claims
until they are rebased onto the accepted predecessor and pass the exact-head release gates.

## Remaining player-first programme and elapsed ETA

Ranges begin when the item becomes the sole active release candidate. They include ordinary review,
focused correction and one clean release cycle. GitHub runner, large-asset upload and archive delays
can extend them. Hardware-dependent acceptance is called out separately.

| Order | Item                                   | Blocking acceptance                                                                                                                                                                  |                                                                                                      Working elapsed ETA |
| ----: | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -----------------------------------------------------------------------------------------------------------------------: |
|     1 | **v0.132 localization + offline root** | Qualify/freeze exact main `140be31c`, publish immutable v0.132.0, admit archive/Pages, and verify public offline launch                                                              | **2–6 hours** for pipeline/public checks, plus **1–3 days** for Android/iPhone/iPad/Safari/desktop cold-install coverage |
|     2 | **Compact mission gallery**            | Reapply onto the accepted cumulative predecessor; preserve full inventories, one-action activation, bounded previews and guarded Confirm; repeat exact qualification and public play |                                                                 **8–16 hours**, plus physical controller/touch follow-up |
|     3 | **UX2 Team quick start**               | Reconcile PR #549 first; valid defaults start directly, optional tuning remains available, and preparation/cancel has one input owner                                                |                                                                                                           **6–12 hours** |
|     4 | **UX2 Couch secondary navigation**     | Reconcile PR #539 after quick-start ownership, preserve its safety fix, collapse overlap and rerun the interrupted focused checks                                                    |                                                                                                           **6–12 hours** |
|     5 | **UX4 terminal retry safety slice**    | Reconcile PR #545; no auto-restart, held-input carry-through, stale result loss or picture/setup mutation                                                                            |                                                                    **4–8 hours**; physical controller follow-up separate |
|     6 | **UX3 gameplay layout and teaching**   | Reconcile PR #543; board/HUD/touch coexistence, contextual cut/Support/rescue teaching and reduced-effects parity                                                                    |                                                                                         **1–2 days**, plus hardware play |
|     7 | **UX4 continuation remainder**         | Reconcile PR #552 countdown/Retry cue, then PR #557 named successors; add campaign endings and duplicate-award proof                                                                 |                                                                                                             **1–2 days** |
|     8 | **UX5 player screens**                 | Carry PRs #542/#548; finish difficulty, Collection/Records/replay, recovery and exact return focus                                                                                   |                                                                                                             **1–2 days** |
|     9 | **UX6 whole-player qualification**     | End-to-end Solo/Versus/Team journeys, accessibility, performance, storage, offline, lifecycle and mixed-input coverage                                                               |                                                                                   **2–4 days**, plus device availability |
|    10 | **P08 map/actor/action closure**       | All 15 Versus maps, both Team arenas/imports, full role/effect inventory and reduced-effects readability                                                                             |                                                                                             **2–4 days**, plus playtests |
|    11 | **P02/P05 audio and themes**           | One audio authority, complete theme compatibility/restoration, transfer/offline behavior and actual listening review                                                                 |                                                                                                             **2–4 days** |
|    12 | **P04/P17 Studio/community authoring** | Cross-mode previews, upload/edit/history/bundle round trips and an independent create/install/play/recover trial                                                                     |                                                                                                             **4–7 days** |
|    13 | **P09/P10 encounters and difficulty**  | Gentle/Standard/Hard, deterministic optional encounters, readable counterplay and 36-case Team matrix                                                                                |                                                                               **3–6 days**, plus human balance playtests |
|    14 | **P11–P15 campaign production**        | FPV, DroneAid, Living Atlas, Retro and Coupa slices with design cards, reviewed art and independent releases                                                                         |                                                                                          **3–7 days per accepted slice** |

The ETA is not a promise that all work can proceed concurrently. Feature preparation may run in
isolated branches, but tags, frozen assets, archive admission and Pages deployment must remain
serialized under one publisher.

## Dependency order and release-slot correction

1. v0.131 is public and accepted. Use product source `a63ad4cc` and publication boundary
   `23e61297` when reconciling its successor.
2. PRs #573/#576 are merged at `2e5db3a2`. Reconcile PR #536 last as the exact v0.132
   version owner and regenerate every cumulative catalog/presentation output from source.
3. PR #536 is merged at `104b168c`; publishing automation PR #581 advances exact main to
   `140be31c` without changing product runtime bytes. Qualify/freeze/publish that exact source before
   accepting v0.132.0 and reapplying the gallery.
4. Reconcile PR #549 after the cumulative gallery so Team quick-start establishes the final
   Start/preparation ownership before secondary navigation edits the same host.
5. Reconcile PR #539 on top of that quick-start source, preserve the stacked `f5c7be05` safety fix,
   collapse its `relay-rescue.mjs` overlap and rerun the interrupted focused checks.
6. Reconcile deliberate terminal retry before broader teaching and result continuation. Preserve
   the rebased PR #552/#557 evidence, but qualify their future cumulative heads from scratch.
7. Carry rebased PRs #542/#548 together in UX5; the test-only fixture must not consume a release slot.
8. Allocate versions only when each cumulative predecessor is public. Do not promote by an old draft
   title or reserved version number.
9. Keep creator/admin, bulk campaign and unrelated visual work draft until the player-critical chain
   is accepted. Do not combine unrelated drafts to fill a release.

## Blockers and concerns

1. **Critical disk pressure:** the shared data volume fell to **116 MiB free** and later fell again
   below 0.4 GiB after the cumulative PR #576 check. PR #539 checks and the first PR #573 test attempt
   stopped safely. Avoid duplicate builds/artifacts, use exact-path sparse or plumbing operations,
   and retire only proven disposable caches.
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
6. **Draft dependency drift:** PRs #542, #548, #552 and #557 have useful focused evidence, but their
   final cumulative sources still depend on the offline/gallery roots and earlier UX owners. PR #536
   is merged and awaits merged-source qualification/publication; PR #539 has a preserved stacked
   safety commit but incomplete checks; PRs #543/#545 and #549 still
   require ordered reconciliation. Never bulk merge the queue.
7. **Release serialization:** only one publisher may own version metadata, tags, frozen assets,
   archive slots and Pages. Parallel implementation cannot make public releases parallel.
8. **Offline footprint:** v0.130 core was within the accepted budget, but localization and offline
   catalogues can change file counts and byte totals. Re-measure emitted artifacts for every root.
9. **Evidence boundary:** the compact-gallery `54fbbe52` qualification is valid historical evidence, not a
   substitute for qualifying the future cumulative gallery source.
10. **v0.132 source gate:** product PRs #573/#576/#536 are merged at `104b168c`; publishing
    automation PR #581 advances exact main to `140be31c`. Localization passed the composed host and
    49/49 focused checks; offline retained its stable patch ID and passed exact-head admission.
    Qualification, freeze and public verification of exact `140be31c` remain before acceptance.
11. **v0.131 closure is complete:** the corrected `a63ad4cc` product source passed exact-source
    qualification, freeze, artifact inspection and evidence assembly; Archive87 admission, selector
    merge `23e61297`, Pages run 36207322888 and independent public EN/UA cross-mode entry checks passed.
    Physical-device bilingual review remains part of the broader hardware caveat, not a publication blocker.

## Completion rule

Every player-facing release follows:

**rebase latest publicly accepted predecessor → implement/reconcile related hunks → focused tests and
browser proof → versioned PR → protected merge → exact-source qualification → immutable
freeze/release → predecessor archive → Pages selector/deploy → public byte and scoped-play
verification → status update.**

A branch, passing focused test, merged PR, workflow, tag or deployment is intermediate. “Complete”
means the public version was verified, with waived suites, physical-device limits and human-review
limits stated explicitly.
