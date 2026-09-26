# Reveal Line delivery status — 26 September 2026

This register is the current source of truth for the player-first delivery programme. It separates
publicly verified releases, accepted source prerequisites, qualification evidence that cannot be
published as-is, and draft work. A merge or successful workflow is not a delivered feature until
its exact cumulative source is frozen, published, admitted to the Pages selector and exercised on
the public site.

## Current boundaries

| Boundary                | Exact state                                                                                           | Meaning                                                                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public player release   | **v0.131.0** — [playable release](https://mekhovov.github.io/revealline/releases/v0.131.0/site/game/) | Current Pages selector. Archive87 admission, deployed bytes and ordinary Solo, Versus and Team entry were independently verified in English and Ukrainian, including Legacy Team entry.                                                        |
| Published next release  | **v0.132.0** — [immutable release](https://github.com/mekhovov/revealline/releases/tag/v0.132.0)      | All nine release assets are public from exact source `109631e70dc3343a5d0f4338616c2bc95b042f6f`. At the final check, Pages still selected v0.131.0 and the v0.132.0 play route returned 404, so public player/offline acceptance remains open. |
| Accepted `main`         | `109631e70dc3343a5d0f4338616c2bc95b042f6f`                                                            | Exact frozen/tagged v0.132.0 source, including offline installed gameplay, player-facing localization and release-controller compatibility.                                                                                                    |
| Next release allocation | Finish **v0.132.0 Pages/offline acceptance**, then reapply the compact gallery as **v0.133.0**        | Admit the published release to the selector and verify public/offline paths before creating the cumulative gallery candidate.                                                                                                                  |
| Test policy             | Long automated suites are temporarily **waived** by committed policy                                  | They were skipped, not passed. Focused regression, source, lint/format, build, provenance, frozen-asset, archive and public checks remain blocking.                                                                                            |

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

| Item                                   | Exact accepted evidence                                                                                                                                                                                                                                                                                                                                                                                                                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.131 localization product root       | PRs [#506](https://github.com/mekhovov/revealline/pull/506) and [#566](https://github.com/mekhovov/revealline/pull/566); source `a63ad4cc32fb14c53fa126d69df42e2e53d1477d`; immutable [v0.131.0 release](https://github.com/mekhovov/revealline/releases/tag/v0.131.0)                                                                                                                                                                            | Qualification/freeze [36204532882](https://github.com/mekhovov/revealline/actions/runs/36204532882), artifact inspection [36205038007](https://github.com/mekhovov/revealline/actions/runs/36205038007), evidence assembly [36205454953](https://github.com/mekhovov/revealline/actions/runs/36205454953), Archive87 admission and Pages [36207322888](https://github.com/mekhovov/revealline/actions/runs/36207322888) passed. All nine release assets are published. Long suites were skipped under policy.                                                                                 |
| v0.132 offline/localized product root  | PRs [#536](https://github.com/mekhovov/revealline/pull/536), [#573](https://github.com/mekhovov/revealline/pull/573), [#576](https://github.com/mekhovov/revealline/pull/576) and release-controller/evidence follow-ups through [#586](https://github.com/mekhovov/revealline/pull/586); exact source/tag `109631e70dc3343a5d0f4338616c2bc95b042f6f`; immutable [v0.132.0 release](https://github.com/mekhovov/revealline/releases/tag/v0.132.0) | Exact qualification/freeze [36212273558](https://github.com/mekhovov/revealline/actions/runs/36212273558), artifact inspection [36212787799](https://github.com/mekhovov/revealline/actions/runs/36212787799), original upload [36213144451](https://github.com/mekhovov/revealline/actions/runs/36213144451) and release gate [36213375672](https://github.com/mekhovov/revealline/actions/runs/36213375672) passed. Artifact `10896665582` is 2,323,663,969 bytes; all nine assets are published. Long suites were skipped under policy. Pages/offline player acceptance is still separate. |
| v0.132 frozen bytes                    | `release.json` and `verification.json` published with v0.132.0                                                                                                                                                                                                                                                                                                                                                                                    | Distribution ZIP is 611,637,915 bytes (`sha256:1eaf41d2…`), manifest total is 611,187,354 bytes across 1,298 files, and source archive is 1,711,790,080 bytes (`sha256:489d96f7…`). The offline inspection passed its Git/mode/hash chain.                                                                                                                                                                                                                                                                                                                                                    |
| Team FPV revision-84 picture authority | PR [#566](https://github.com/mekhovov/revealline/pull/566), included since `a63ad4cc`                                                                                                                                                                                                                                                                                                                                                             | Current starter and historical-import bindings match FPV revision 84 while retaining 58–83. Binding contracts passed 94/94; public EN/UA Team and Legacy Team entry were independently verified in v0.131.0.                                                                                                                                                                                                                                                                                                                                                                                  |
| Public selector boundary               | selector/archive merge `23e6129782e08ed826686f137a0989e5f154732a`                                                                                                                                                                                                                                                                                                                                                                                 | Pages still selected v0.131.0 at the final read. Publishing the GitHub release and passing its release gate do not establish selector admission or public play.                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Qualified evidence only

The compact-gallery merge source `54fbbe52c1622d0e3b0a6a148508b6ea507bdec5` completed exact-source
qualification in run [36187128651](https://github.com/mekhovov/revealline/actions/runs/36187128651).
That result is **evidence only**:

- PR [#535](https://github.com/mekhovov/revealline/pull/535) had merged v0.133.0 before the then-open
  v0.131 and offline product roots.
- PR #544 reverted that merge while preserving all commits and review history.
- The frozen/qualified `54fbbe52` source must not be tagged, selected or published because it
  does not contain the accepted v0.131 root or the now-published cumulative v0.132 root.
- After v0.132 is admitted to Pages and publicly verified, the gallery must be reapplied or reconciled
  onto exact source `109631e70`, assigned v0.133.0, and qualified again. Earlier passing evidence reduces
  implementation risk but does not qualify the reconciled release.

## In progress and draft queue

| Planned release / phase                       | Current work                                                                                                                     | Status and dependency                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v0.132.0 — Pages/offline acceptance**       | immutable [v0.132.0 release](https://github.com/mekhovov/revealline/releases/tag/v0.132.0), exact source `109631e70`             | Qualification, inspection, uploads and immutable publication are complete. Archive/admit the release, deploy Pages, verify selector/source/bytes and exercise the stable launcher plus ordinary EN/UA Solo, Versus, Team and Legacy Team paths. Physical cold-install coverage remains separate.                                                                        |
| **v0.133.0 — compact mission gallery**        | draft reconciliation PR [#590](https://github.com/mekhovov/revealline/pull/590), head `3d3b52f104075dd5f0011c80b4ba6309ca4361e2` | Reapplies the preserved gallery onto exact v0.132 source `109631e70`. Six historical conflicts were resolved; syntax, formatting, version/lock consistency and diff checks pass. Hosted preflight passes, while focused/build jobs are skipped under policy and release-ready blocks promotion until v0.132 Pages acceptance. Runtime/browser/controller checks remain. |
| **UX2 — Team quick start**                    | draft PR [#549](https://github.com/mekhovov/revealline/pull/549), head `59d40ae82b38d124830ba6119a036423483930a4`                | Stable patch identity and focused evidence remain useful, but the branch now conflicts with cumulative `main`. Reconcile only after gallery ownership; rerun quick-start parity, keyboard, modeled-controller and touch/browser checks.                                                                                                                                 |
| **UX2 — Couch secondary navigation**          | draft PR [#539](https://github.com/mekhovov/revealline/pull/539); preserved stacked safety patch                                 | Reconcile after gallery and PR #549, remove duplicate overlap and close the controller lifecycle case. Earlier focused work stopped under disk pressure and is evidence only.                                                                                                                                                                                           |
| **UX4 — deliberate terminal retry**           | draft PR [#545](https://github.com/mekhovov/revealline/pull/545), remote head `459c1acb`                                         | A local safety rehearsal preserved stable patch ID `1a63b1d5…` without conflict on the cumulative offline runtime. Team recovery 3/3, Team Skip 1/1 and Solo terminal self-contact 1/1 plus scoped static checks pass. Final reconciliation still follows gallery/input ownership and physical-controller review.                                                       |
| **UX3 — contextual Team teaching**            | draft PR [#543](https://github.com/mekhovov/revealline/pull/543)                                                                 | Focused 5/5 evidence for cut, Support and rescue cues. Reconcile after preceding cumulative UX owners and complete real-event browser review in portrait and short landscape.                                                                                                                                                                                           |
| **UX4 — Versus start countdown**              | draft PR [#552](https://github.com/mekhovov/revealline/pull/552)                                                                 | Focused cue and continuous-Next evidence passes 15/15; localization and scoped static checks passed on its old base. Reconcile and qualify the future cumulative source from scratch.                                                                                                                                                                                   |
| **UX4 — named result destinations**           | draft PR [#557](https://github.com/mekhovov/revealline/pull/557)                                                                 | Result policy 2/2, Solo 3/3 and Versus 1/1 passed on its old base. Reconcile after countdown ownership, then add campaign-ending and duplicate-award proof.                                                                                                                                                                                                             |
| **UX5 — Pause Settings/Help return**          | draft PR [#542](https://github.com/mekhovov/revealline/pull/542)                                                                 | Focused pause/modal return evidence passed 20/20 on its old base. Carry after UX2–UX4 while preserving exact opener/checkpoint behavior.                                                                                                                                                                                                                                |
| **Test prerequisite — Collection disclosure** | draft PR [#548](https://github.com/mekhovov/revealline/pull/548)                                                                 | Focused Collection disclosure/appearance/return checks passed 7/7. It changes no runtime behavior and should travel with PR #542 instead of consuming a player release slot.                                                                                                                                                                                            |

Drafts are implementation inputs. Their green focused checks do not authorize merge or public claims
until they are rebased onto the accepted predecessor and pass the exact-head release gates.

## Remaining player-first programme and elapsed ETA

Ranges begin when the item becomes the sole active release candidate. They include ordinary review,
focused correction and one clean release cycle. GitHub runner, large-asset upload and archive delays
can extend them. Hardware-dependent acceptance is called out separately.

| Order | Item                                   | Blocking acceptance                                                                                                                                                            |                                                                                                   Working elapsed ETA |
| ----: | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------: |
|     1 | **v0.132 Pages/offline acceptance**    | Archive/admit the published release, deploy exact bytes, verify selector and source identity, and exercise launcher/install/update/remove/recovery plus EN/UA cross-mode entry | **1–3 hours** for Pages/public checks, plus **1–3 days** for Android/iPhone/iPad/Safari/desktop cold-install coverage |
|     2 | **v0.133 compact mission gallery**     | Reapply onto accepted v0.132; preserve full inventories, one-action activation, bounded previews and guarded Confirm; repeat exact qualification and public play               |                                                              **8–16 hours**, plus physical controller/touch follow-up |
|     3 | **UX2 Team quick start**               | Reconcile PR #549 first; valid defaults start directly, optional tuning remains available and preparation/cancel has one input owner                                           |                                                                                                        **6–12 hours** |
|     4 | **UX2 Couch secondary navigation**     | Reconcile PR #539 after quick-start ownership, preserve its safety fix, collapse overlap and rerun interrupted checks                                                          |                                                                                                        **6–12 hours** |
|     5 | **UX4 terminal retry safety slice**    | Reconcile PR #545; no auto-restart, held-input carry-through, stale result loss or picture/setup mutation                                                                      |                                                                 **4–8 hours**; physical-controller follow-up separate |
|     6 | **UX3 gameplay layout and teaching**   | Reconcile PR #543; board/HUD/touch coexistence, contextual cut/Support/rescue teaching and reduced-effects parity                                                              |                                                                                      **1–2 days**, plus hardware play |
|     7 | **UX4 continuation remainder**         | Reconcile PR #552 countdown/Retry cue, then PR #557 named successors; add campaign endings and duplicate-award proof                                                           |                                                                                                          **1–2 days** |
|     8 | **UX5 player screens**                 | Carry PRs #542/#548; finish difficulty, Collection/Records/replay, recovery and exact return focus                                                                             |                                                                                                          **1–2 days** |
|     9 | **UX6 whole-player qualification**     | End-to-end Solo/Versus/Team journeys, accessibility, performance, storage, offline, lifecycle and mixed-input coverage                                                         |                                                                                **2–4 days**, plus device availability |
|    10 | **P08 map/actor/action closure**       | All 15 Versus maps, both Team arenas/imports, full role/effect inventory and reduced-effects readability                                                                       |                                                                                          **2–4 days**, plus playtests |
|    11 | **P02/P05 audio and themes**           | One audio authority, complete theme compatibility/restoration, transfer/offline behavior and actual listening review                                                           |                                                                                                          **2–4 days** |
|    12 | **P04/P17 Studio/community authoring** | Cross-mode previews, upload/edit/history/bundle round trips and an independent create/install/play/recover trial                                                               |                                                                                                          **4–7 days** |
|    13 | **P09/P10 encounters and difficulty**  | Gentle/Standard/Hard, deterministic optional encounters, readable counterplay and 36-case Team matrix                                                                          |                                                                            **3–6 days**, plus human balance playtests |
|    14 | **P11–P15 campaign production**        | FPV, DroneAid, Living Atlas, Retro and Coupa slices with design cards, reviewed art and independent releases                                                                   |                                                                                       **3–7 days per accepted slice** |

The ETA is not a promise that all work can proceed concurrently. Feature preparation may run in
isolated branches, but tags, frozen assets, archive admission and Pages deployment must remain
serialized under one publisher.

## Dependency order and release-slot correction

1. v0.132.0 is immutable and published from exact source `109631e70`; archive/selector admission,
   Pages deployment and public offline/player verification still gate acceptance.
2. Keep draft PR #590 on exact v0.132 source `109631e70` while v0.132 Pages acceptance closes.
   Its six conflict resolutions and static evidence are implementation inputs; run exact hosted focused,
   browser and controller checks before promotion. Old qualification cannot transfer.
3. Reconcile PR #549 on top of the accepted gallery so Team quick-start establishes final
   Start/preparation ownership before secondary navigation edits the same host.
4. Reconcile PR #539 on top of quick-start, preserve its safety fix, collapse `relay-rescue.mjs`
   overlap and rerun the interrupted focused checks.
5. Reconcile deliberate terminal retry before broader teaching and result continuation. Preserve
   PR #552/#557 evidence, but qualify each future cumulative head from scratch.
6. Carry PRs #542/#548 together in UX5; the test-only fixture must not consume a release slot.
7. Allocate later versions only when each cumulative predecessor is publicly accepted. Do not
   promote by an old draft title or historical version number.
8. Keep creator/admin, bulk campaign and unrelated visual work draft until the player-critical chain
   is accepted. Do not combine unrelated drafts to fill a release.

## Blockers and concerns

1. **Critical disk pressure:** free space has oscillated between roughly 0.1 and 0.6 GiB during
   this release train. Worktree creation and focused checks have already stopped safely for lack of
   space. Use exact-path sparse/plumbing operations, avoid duplicate builds/artifacts and retire
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
5. **Large cumulative roots:** v0.132 is qualified and immutable, but offline installation changes
   content ownership, storage and lifecycle behavior. Public route checks and physical cold-install
   coverage remain necessary; a published archive alone does not certify installed play.
6. **Draft dependency drift:** gallery PR #590 is reconciled but awaits runtime/browser/controller evidence
   and v0.132 Pages acceptance. PR #549 now conflicts with cumulative main; PR #539 has a preserved safety patch but incomplete checks; PRs #542/#543/
   #545/#548/#552/#557 retain useful focused evidence on older bases. Reconcile in order and never
   bulk merge the queue.
7. **Release serialization:** only one publisher may own version metadata, tags, frozen assets,
   archive slots and Pages. Parallel implementation cannot make public releases parallel.
8. **Offline footprint:** v0.132 emits 1,298 manifest files / 611,187,354 bytes and a
   611,637,915-byte ZIP. Storage, quota, update peak and optional soundtrack behavior still need
   public and physical-device measurement; retain exact-byte checks for every successor.
9. **Evidence boundary:** the compact-gallery `54fbbe52` qualification is valid historical evidence, not a
   substitute for qualifying the future cumulative gallery source.
10. **v0.132 Pages/offline closure:** exact source `109631e70` passed qualification/freeze,
    independent artifact inspection, original upload and immutable publication with all nine assets.
    At the final read, Pages still selected v0.131.0 and the v0.132 play route returned 404. Archive/
    selector admission, deployed-byte identity, public EN/UA cross-mode play and offline launcher
    verification remain blocking before v0.133 begins.
11. **v0.131 closure is complete:** the corrected `a63ad4cc` product source passed qualification,
    freeze, artifact inspection and evidence assembly; Archive87 admission, selector merge
    `23e61297`, Pages run 36207322888 and independent public EN/UA cross-mode entry checks passed.
    Physical-device bilingual review remains part of the broader hardware caveat.

## Completion rule

Every player-facing release follows:

**rebase latest publicly accepted predecessor → implement/reconcile related hunks → focused tests and
browser proof → versioned PR → protected merge → exact-source qualification → immutable
freeze/release → predecessor archive → Pages selector/deploy → public byte and scoped-play
verification → status update.**

A branch, passing focused test, merged PR, workflow, tag or deployment is intermediate. “Complete”
means the public version was verified, with waived suites, physical-device limits and human-review
limits stated explicitly.
