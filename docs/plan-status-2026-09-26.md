# Reveal Line delivery status · 26 September 2026

This is the current execution view for the Ukrainian spatial-redesign programme and its immediate
release dependency. Older dated plans remain historical evidence, not a claim that their queued
versions or acceptance gates are still current.

## Public and release state

- Latest GitHub release: **v0.132.5**, published from accepted source
  `a8881ac17e44f38fb1e9dc15428899992727cc78`. PR #668 selected its immutable assets for Pages;
  current `main` is `8f7ea5540d6851fb2d6d77a42c899e071e65e52a`. This lane has not repeated the
  frozen public play journey, so the release and selector merge are not represented here as new
  independent public acceptance.
- PR #654 merged the v0.132.5 source, and PR #660 then repaired its stale Field Kit review ledger.
  Qualification correctly rejected the earlier stale ledger after a renderer dependency entered the
  Team review closure; the accepted correction preserves that fail-closed gate.
- Corrective PR #663 merged the exact Team picture revision-90 binding after its focused gate passed.
  Its predecessor run failed closed before release creation; the corrected source is the published
  v0.132.5 target.
- Test-only PR #669 isolates the remaining Solo compact-filter host failure on current `main`. Its
  exact failing case now passes, as do all 8 controller-host cases and the 167-case compact/controller
  cohort. Its current-main hosted focused gate is green and release-ready. Runtime behavior is
  unchanged; review and merge remain pending. PR #530's independent exact-head rerun correctly
  remains red because that older branch does not yet contain the isolated fixture correction.
- The cultural/pacing successor chain through draft PR #670/v30 has been rebased onto current `main`. The 24
  existing remote tips were force-updated atomically with exact old-head leases. All 85 rewritten
  commits range-diff one-to-one with their prior versions. The v0.149.0 successor is draft PR #650
  at `c1c39ced0`; fixture reconciliation maps to PR #651 at `4f4ae8301`, and the pacing inventory
  maps to PR #661 at `5acdcaa50`.
  Independent PR #657 remains at `6459e8fbc2e11f0c3bd6d735885c674c9e7295b8`
  and now needs its own current-main rebase before promotion. The dirty root checkout was not changed.

## Completed source work

| Scope                                            | State                         | Evidence boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Journey Ukrainian spatial stack v12-v24          | Rebased and pushed            | Candidate source only; each draft PR still needs its own promotion and public verification.                                                                                                                                                                                                                                                                                                                                                                           |
| Apex v25 / PR #625                               | Clean draft, source `0.140.0` | Earlier focused and production-build evidence exists; the exact terminal-base head still needs release CI.                                                                                                                                                                                                                                                                                                                                                            |
| Complete Team adoption / PR #630                 | Clean draft, source `0.141.0` | Complete twelve-mission Team edition is wired as current in the candidate stack, with older editions preserved.                                                                                                                                                                                                                                                                                                                                                       |
| First Team Ukrainian slice / PR #636             | Clean draft, source `0.142.0` | Three redesigned identities, 78/78 focused integration evidence, earlier production build; not public.                                                                                                                                                                                                                                                                                                                                                                |
| Second Team Ukrainian slice / PR #642            | Clean non-default draft       | Crossed gardens, Split orchards and Weaver crossing redesigned copy-on-write; no selector/default/version change yet.                                                                                                                                                                                                                                                                                                                                                 |
| Second Team current edition / PR #650            | Clean draft, source `0.149.0` | Default/previous edition, Team library, Studio, exact Next, isolated progress and EN/UK wiring; earlier focused cohort 83/83 and localization validation pass. The 54/54 zero-skip runtime cohort passed on the prior exact head; the rebased `730ada618` still needs exact-head rerun before promotion.                                                                                                                                                              |
| Unified-library fixture reconciliation / PR #651 | Clean draft, test/docs only   | Confirms 91 current + 48 prior Journey + 188 Classic = 327 unique rows and updates stale 201/279 and `whole-spatial-v5/v6` expectations to current v25 ownership.                                                                                                                                                                                                                                                                                                     |
| Team opaque-owner continuation / PR #657         | Ready isolated hotfix         | Shared Next no longer JSON-parses opaque Team Classic owner IDs; Current/Original lanes remain separate and Classic → Custom continuation is restored. Exact current-main continuation/localization/impact cohort passes 27/27 at `6459e8fbc2e11f0c3bd6d735885c674c9e7295b8`; not merged or public.                                                                                                                                                                   |
| Current Journey pacing inventory / PR #661       | Clean stacked draft           | Adds a reusable runtime-prepared spatial-variety inspector and pins exact v25 facts: 91 source missions, 71 core missions, bands 1–12, consistent Standard craft speed and 21 post-opening open/plain review candidates. Focused checks pass 4/4; this is not human balance evidence.                                                                                                                                                                                 |
| Relay cultural completion / PR #664              | Clean explicit v26 draft      | Redesigns Spiral stores, Nested relays and Watchpost exchange from bounded official-museum vocabulary; preserves v25/default ownership and reduces post-opening open/plain candidates from 21 to 18. Its exact current-main tip is `52f0c031b`; the earlier runtime cohort passed 140/140 with zero skips and the 85-commit range-diff is one-to-one. Hosted exact-head qualification remains.                                                                        |
| Crosswind cultural completion / PR #665          | Clean explicit v27 draft      | Redesigns Survey markers, Compass array and Outer loop with original wall fields informed by three official museum records. Preserves v25/default and v26 ownership, actors, foundations, arrows and objectives; reduces the post-opening open/plain queue from 18 to 15. Its exact current-main tip is `f44bce786`; the earlier cohort passed 155/155 with zero skips and the 85-commit range-diff is one-to-one. Hosted exact-head qualification remains.           |
| Fracture/Apex cultural completion / PR #666      | Clean explicit v28 draft      | Redesigns Bank the crossing, Five anchors and Final broadcast with original spatial fields informed by official Opishne museum, UNESCO Crimean Tatar Örnek and Museum Fund records. Preserves v25/default and v27 history, gameplay rules, objectives, relays, bonuses and actor roles; reduces the open/plain review queue from 15 to 12. Rebased evidence head `f77ca756a` maps one-to-one from the 158/158 checked patch. Hosted exact-head qualification remains. |
| Neon cultural completion / PR #667               | Clean explicit v29 draft      | Adds original wall fields to Folded corner, Inside out and Four quarters using bounded Museum Fund, Ivan Honchar Museum and UNESCO vocabulary. Preserves v25/default and v28 history, foundations, spawns, actors and rules; retains Side-door bays as an intentional open contour puzzle and reduces the review queue from 12 to 9. Rebased evidence head `f616a0d04` maps one-to-one from the 161/161 checked patch. Hosted exact-head qualification remains.       |
| Rover cultural completion / PR #670              | Clean explicit v30 draft      | Promotes the reviewed Split berths and Stepped return Ukrainian/FPV geometry into the current chain while preserving the newer pressure actors and rules. Exact rebased runtime/evidence head `cc43c2619` passes the 150/150 candidate/route/bootstrap cohort with zero skips; validation passed before the publication-only main rebase and lint/format/diff pass on the rebased head. The open/plain queue falls from 9 to 7. Hosted qualification remains.         |
| Border cultural completion / PR #671             | Clean explicit v31 draft      | Adds original Reshetylivka aperture, Petrykivka branch and Kosiv bilateral wall fields to Second landing, Long rail and New frontier. Preserves current actors, objectives, bonuses, foundations, art and rules; the candidate/route/bootstrap cohort passes 164/164 with zero skips, repository validation and lint/format/diff pass, and the open/plain queue falls from 7 to 4. Hosted qualification remains.                                                      |
| Border frontier/pocket completion / PR #672      | Clean explicit v32 draft      | Adds original Bukovyna wave/dogleg and Podillia end-weighted wall fields to Turn the corner and Return pocket. Preserves current actors, objectives, bonuses, foundations, art and rules; the candidate/route/bootstrap/navigation cohort passes 162/162 with zero skips. The queue closes with Behind the patrol and Side-door bays deliberately retained as open lessons. Repository validation and lint/format/diff pass; hosted qualification remains.            |

After the final main rebase, an uncontended bounded host rerun passed all selected corrected cases:
four Solo scenarios, four Versus scenarios, two representative Team source routes and the three-stage
Solo → Versus → Solo restoration. The test runner recorded 14 passing test/subtest records and no
failures. The earlier two chooser-opening timeouts occurred while another worktree continuously used
a CPU core; they were not changed-expectation failures. The full long host suite remains unrun.

The lightweight runtime cohort passed **54/54 with zero skips** on PR #650's prior exact head.
It covers default Team entry, handoff/return validation, both cultural topology/route editions,
isolated progress, preserved impact/complete-specialist editions and cross-campaign Next. It does
not replace the heavier chooser-host rerun, physical devices, public frozen-build checks or human
balance review. The current rebased head still needs an exact-head rerun.

The second Team slice now has **13/13** focused checks. Every changed mission keeps one connected
field, idle-safe starts on all presets, two distinct no-down approaches, and a two-closure exchange
where the second pilot traverses the first pilot's reclaimed route without cutting or using Support.
Fresh input-only searches also found full clears on every preset; Standard routes are pinned at
33.8-52.2 seconds with both pilots contributing, no downs and no Support. This proves bounded route
feasibility and rules out a mandatory late-cleanup tail in those fixtures; it does not prove fun.

## Remaining implementation and ETA

Effort starts when the item has an uncontested release or implementation slot. GitHub runner,
large-asset and archive delays are outside these estimates.

| Priority | Remaining item                          | Exit condition                                                                                                                                                                                                                                                                                                                |                                                    Indicative effort |
| -------: | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------: |
|        0 | Finish v0.132.5 public acceptance       | The immutable release exists and PR #668 selected it for Pages; complete bounded public proof without mixing in release-optimization changes                                                                                                                                                                                  |                               **1–4 hours** for bounded public proof |
|        1 | Promote the cultural Journey chain      | Review/merge in dependency order, exact-head qualification, immutable release and public play for each accepted batch                                                                                                                                                                                                         |                               **1–2 working days per release batch** |
|        2 | Complete second Team slice and fixtures | Review PRs #650/#651, immutable public delivery and frozen-build checks; source wiring and bounded runtime/host verification are complete                                                                                                                                                                                     |                                     **3–6 hours** plus release queue |
|        3 | Team continuation and qualification     | Review/publish PR #657; paired-board fairness, controller/touch/keyboard, cross-campaign Next, Skip, reload/Continue and public frozen-build proof                                                                                                                                                                            |                      **8–16 hours** plus release queue/device access |
|        4 | Whole-Journey pacing and accessibility  | PR #661 establishes the exact-current campaign/spatial inventory; PRs #664-#671 and local v32 address eight bounded repetition clusters. The disposition queue is resolved with two intentional open lessons retained; remaining work is reduced-effects, contrast, small-screen, performance and deterministic qualification | **2–4 working days** for accessibility and performance qualification |
|        5 | Human balance and cultural review       | Understandable failures, distinct missions, enjoyable retries and cultural review by people                                                                                                                                                                                                                                   |                   **1–2 days synthesis** after testers are available |

Existing v0.133-v0.137 player-UX drafts occupy the nominal release sequence. Cultural PR titles
currently target v0.138 onward, but version numbers must be assigned by the sole publisher from the
accepted predecessor; draft labels do not reserve a release.

## Blockers and concerns

1. **Serialized publication:** one publisher owns tags, frozen assets, archives and Pages. Feature
   preparation can continue in parallel, but releases cannot safely publish in parallel. The
   publisher's latest queue audit reports that none of the 46 inspected PRs is merge-authorized yet;
   a green or clean status alone is not release permission.
2. **Long-suite waiver:** focused checks are real; skipped long suites are not passes. Exact source,
   validation, formatting, build/provenance, hashes, archive preservation and public availability
   remain mandatory.
3. **Second Team human balance:** bounded no-Support full clears now exist on every preset and the
   Standard routes are pinned. These do not establish human cooperation quality or enjoyment.
4. **Full-suite boundary:** the duplicate audit confirms the 327-row inventory is intentional and
   unique. The corrected focused cases pass, but the entire long host suite has not been rerun and
   is not represented as passing.
5. **Human/device evidence:** deterministic routes cannot establish enjoyment, cultural approval or
   physical controller/touch behavior.
6. **Disk pressure:** only reviewed disposable build caches were removed; worktrees, releases, media,
   patches and active task data were preserved. Free space is now about 6 GiB. Avoid duplicate
   production archives and never remove unpushed source, user media or another task's workspace.
7. **Host performance:** the uncontended PR #651 scenarios pass, but individual chooser paths took
   about 5.5–30.6 seconds in the fixture harness. This closes the corrected-assertion gap, not the
   broader startup/performance qualification.
8. **First cultural gate:** PR #530's exact-head rerun passed preflight and the wider selected gates,
   but its controller-host file again failed only the Solo compact-filter focus assertion: 7/8 cases
   passed. PR #669 corrects the fixture's clock/rearm model on exact `main`; its hosted focused gate
   is green. PR #530 cannot become green until that isolated correction is merged and incorporated;
   the failed rerun is not represented as a pass.
9. **Inventory is not balance evidence:** PR #661 finds 21 post-opening missions with neither wall
   nor slow/lethal terrain and confirms consistent Standard speed and post-opening actor counts.
   Those are review candidates, not automatic defects; deterministic routes and human play still
   decide whether an open layout is distinct, fair and enjoyable.
10. **v26 remains opt-in:** PR #664 registers a preserved successor and repairs native bootstrap
    links for v12-v26, but deliberately leaves v25 as the default until review and release allocation.
    Its deterministic 140-test cohort does not establish enjoyment or cultural approval.
11. **v27 remains opt-in:** PR #665 registers a separate v27 review identity while keeping v25 as
    default. Its 155-test sequential cohort and repository validation pass, but it still needs hosted
    exact-head qualification, review and promotion through the serialized release lane.
12. **v28 remains opt-in:** PR #666 preserves v25 as default and v27 as history. Its exact-head
    candidate/route/bootstrap/host cohort passes 158/158, along with repository validation and
    targeted lint/format/diff checks. Review, hosted qualification, promotion and public evidence
    are still required.
13. **v29 remains opt-in:** PR #667 preserves v25 as default and v28 as history. Its exact-head
    candidate/route/bootstrap/host cohort passes 161/161, along with repository validation and
    targeted lint/format/diff checks. Review, hosted qualification, promotion and public evidence
    are still required.
14. **v30 remains opt-in:** draft PR #670 preserves v25 as default and v29 as history. Its exact
    rebased candidate/route/bootstrap cohort passes 150/150 with zero skips. Repository validation
    passed before the publication-only main rebase, all 85 patches map one-to-one, and targeted
    lint/format/diff checks pass on the rebased head. Hosted qualification, review, promotion and
    public evidence are still required.
15. **v31 remains opt-in:** draft PR #671 preserves v25 as default and v30 as history. Its
    candidate/route/bootstrap cohort passes 164/164 with zero skips, and repository validation plus
    targeted lint/format/diff checks pass. Hosted qualification, review, promotion and public
    evidence remain.
16. **v32 remains opt-in:** draft PR #672 preserves v25 as default and v31 as history. Its
    candidate/route/bootstrap/navigation cohort passes 162/162 with zero skips, and repository
    validation plus targeted lint/format/diff checks pass. The two remaining open/plain boards are
    intentional accepted lessons, not unfinished count targets. Hosted qualification, review,
    promotion and public evidence remain.

## Immediate execution order

1. Let the sole publisher complete bounded public acceptance for the existing immutable v0.132.5
   release and Pages selector; keep release-throughput experiments out of that path.
2. Qualify and publish isolated PR #657 after the active release lane; do not wait for the full
   cultural stack to restore Team Classic → Custom Next.
3. Review and merge green test-only PR #669, incorporate that isolated fixture correction into PR
   #530, then rerun its exact head. The latest pre-correction rerun failed the same one Solo case.
4. Keep the rebased cultural PR chain clean and reviewable while the public release lane completes.
5. Review and qualify the bounded v0.149.0 PR #650 at its exact head.
6. Review draft PR #651 and publish the isolated library-fixture reconciliation after its focused
   duplicate/ownership audit.
7. Review draft PR #661 after #651, then PR #664. v26 preserves v25 and completes the Relay spatial
   cluster without changing the default before promotion.
8. Review and host-qualify PR #667, then draft PRs #670-#672. Do not redesign the two intentional
   open lessons merely to force a zero count.
9. Promote cultural releases in dependency order, reporting actual public delivery rather than a
   merge or workflow start.

The original P13-P15 whole-Journey pacing, Team cooperation, accessibility/performance and final
human acceptance remain incomplete.
