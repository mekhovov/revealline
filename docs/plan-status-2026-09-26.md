# Reveal Line delivery status · 26 September 2026

This is the current execution view for the Ukrainian spatial-redesign programme and its immediate
release dependency. Older dated plans remain historical evidence, not a claim that their queued
versions or acceptance gates are still current.

## Public and release state

- Latest GitHub release: **v0.141.0**, published from accepted source
  `5d6c97c850a648c5ebe93d3cf57731aeb67d0bbb` on 26 September 2026. PR #673 selected its
  immutable assets for Pages; current `main` is
  `b4ef4b3024675bd8e12b13af28215553707d1bff`. This lane has not repeated the frozen public play
  journey, so the release and selector merge are not represented here as new independent public
  acceptance.
- The accepted v0.141.0 creator/media merge is now the source base for the cultural stack. Its
  creator, upload, localization, media and publication files are preserved by the rebase; no draft
  cultural version is allowed to downgrade the accepted release.
- Test-only PR #669 isolates the remaining Solo compact-filter host failure. Its prior-base exact
  failing case passes, as do all 8 controller-host cases and the 167-case compact/controller cohort.
  Runtime behavior is unchanged; review, current-main rebase and rerun remain pending. PR #530's
  independent exact-head rerun correctly remains red because that older branch does not yet contain
  the isolated fixture correction.
- The cultural/pacing successor chain through draft PR #672/v32 has been replayed onto current
  `main`. All **97** stack commits and all **27** stacked branch tips retain the same order and subjects;
  the only manual resolutions preserved accepted v0.141.0 version files and regenerated the derived
  EN/UK catalog from the combined creator and cultural source catalogs. The focused exact-head
  route/bootstrap/navigation cohort passes **201/201 with zero skips**, and repository validation
  passes for 10,138 localized messages, 7,994 references and 1,268 files. All 27 remote tips were
  replaced atomically with exact old-head leases; PRs #650, #651, #661, #664-#667 and #670-#672
  resolve cleanly against their intended rebased predecessors. Independent PR #657 is now rebased
  separately onto current `main` at `f5333b348ddb6cb7c730e59bf007b3b58dd1c96a`; its runtime
  patch remains range-diff identical and its accepted-main fixture reconciliation is isolated from
  the cultural chain. The dirty root checkout was not changed.

## Completed source work

| Scope                                            | State                         | Evidence boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Journey Ukrainian spatial stack v12-v24          | Rebased and pushed            | Candidate source only; each draft PR still needs its own promotion and public verification.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Apex v25 / PR #625                               | Clean draft, source `0.140.0` | Earlier focused and production-build evidence exists; the exact terminal-base head still needs release CI.                                                                                                                                                                                                                                                                                                                                                                                                       |
| Complete Team adoption / PR #630                 | Clean draft, source `0.141.0` | Complete twelve-mission Team edition is wired as current in the candidate stack, with older editions preserved.                                                                                                                                                                                                                                                                                                                                                                                                  |
| First Team Ukrainian slice / PR #636             | Clean draft, source `0.142.0` | Three redesigned identities, 78/78 focused integration evidence, earlier production build; not public.                                                                                                                                                                                                                                                                                                                                                                                                           |
| Second Team Ukrainian slice / PR #642            | Clean non-default draft       | Crossed gardens, Split orchards and Weaver crossing redesigned copy-on-write; no selector/default/version change yet.                                                                                                                                                                                                                                                                                                                                                                                            |
| Second Team current edition / PR #650            | Clean draft, source `0.149.0` | Default/previous edition, Team library, Studio, exact Next, isolated progress and EN/UK wiring. Current doc-only-rebased tip `6de9e3cd8` maps from the exact 79/79 zero-skip Team cohort covering current/default entry, v1/v2 cultural routes, preset/seed feasibility, safe openings, no-Support exchanges, pinned full clears, handoffs, Studio, preserved impact editions and exact Next. Hosted gates remain.                                                                                               |
| Unified-library fixture reconciliation / PR #651 | Clean draft, test/docs only   | Confirms 91 current + 48 prior Journey + 188 Classic = 327 unique rows and updates stale 201/279 and `whole-spatial-v5/v6` expectations to current v25 ownership. Current doc-only-rebased tip `cc84407f8` maps from the exact 82/82 zero-skip run across the four corrected Solo/Versus/Team-return host files.                                                                                                                                                                                                 |
| Team opaque-owner continuation / PR #657         | Rebased isolated hotfix       | Shared Next no longer JSON-parses opaque Team Classic owner IDs; Current/Original lanes remain separate and Classic → Custom continuation is restored. Exact current-main head `f5333b348` passes 33/33 continuation/localization/historical-impact/Team-impact checks with zero skips, targeted lint/format/diff checks and repository validation. The only post-rebase change is a fixture-only accepted Team-attempt hook; not merged or public.                                                              |
| Current Journey pacing inventory / PR #661       | Clean stacked draft           | Adds a reusable runtime-prepared spatial-variety inspector and pins exact v25 facts: 91 source missions, 71 core missions, bands 1–12, consistent Standard craft speed and 21 post-opening open/plain review candidates. Current doc-only-rebased tip `25b4c2b62` maps from the 4/4, ESLint and Prettier pass after correcting the report's formatting drift; this is not human balance evidence.                                                                                                                |
| Relay cultural completion / PR #664              | Clean explicit v26 draft      | Redesigns Spiral stores, Nested relays and Watchpost exchange from bounded official-museum vocabulary; preserves v25/default ownership and reduces post-opening open/plain candidates from 21 to 18. Current doc-only-rebased tip `0ab499913` maps from the corrected exact 156/156 zero-skip run and owns the accepted creator actor-material fixture pass-through. Hosted gates remain.                                                                                                                        |
| Crosswind cultural completion / PR #665          | Clean explicit v27 draft      | Redesigns Survey markers, Compass array and Outer loop with original wall fields informed by three official museum records. Preserves v25/default and v26 ownership, actors, foundations, arrows and objectives; reduces the post-opening open/plain queue from 18 to 15. Exact current tip `59211391b` passes its 159/159 zero-skip candidate, route, bootstrap and host cohort; the duplicate later fixture patch remains dropped because PR #664 owns it. Hosted gates remain.                                |
| Fracture/Apex cultural completion / PR #666      | Clean explicit v28 draft      | Redesigns Bank the crossing, Five anchors and Final broadcast with original spatial fields informed by official Opishne museum, UNESCO Crimean Tatar Örnek and Museum Fund records. Preserves v25/default and v27 history, gameplay rules, objectives, relays, bonuses and actor roles; reduces the open/plain review queue from 15 to 12. Exact current tip `bb31fd513` passes its 162/162 zero-skip candidate, route, bootstrap and host cohort. Hosted gates remain.                                          |
| Neon cultural completion / PR #667               | Clean explicit v29 draft      | Adds original wall fields to Folded corner, Inside out and Four quarters using bounded Museum Fund, Ivan Honchar Museum and UNESCO vocabulary. Preserves v25/default and v28 history, foundations, spawns, actors and rules; retains Side-door bays as an intentional open contour puzzle and reduces the review queue from 12 to 9. Exact current tip `15a6ef79f` passes its 165/165 zero-skip candidate, route, bootstrap and host cohort. Hosted gates remain.                                                |
| Rover cultural completion / PR #670              | Clean explicit v30 draft      | Promotes the reviewed Split berths and Stepped return Ukrainian/FPV geometry into the current chain while preserving the newer pressure actors and rules. Exact current tip `f419d8c91` passes its expanded 156/156 zero-skip candidate, route, bootstrap and host cohort, superseding the prior 150-test receipt. The open/plain queue falls from 9 to 7. Hosted qualification remains.                                                                                                                         |
| Border cultural completion / PR #671             | Clean explicit v31 draft      | Adds original Reshetylivka aperture, Petrykivka branch and Kosiv bilateral wall fields to Second landing, Long rail and New frontier. Preserves current actors, objectives, bonuses, foundations, art and rules; exact current tip `1e83e1143` passes its 170/170 zero-skip candidate, route, bootstrap and host cohort. The open/plain queue falls from 7 to 4. Hosted qualification remains.                                                                                                                   |
| Border frontier/pocket completion / PR #672      | Clean explicit v32 draft      | Adds original Bukovyna wave/dogleg and Podillia end-weighted wall fields to Turn the corner and Return pocket. Preserves current actors, objectives, bonuses, foundations, art and rules. Runtime source tip `d35810836` plus plan-only descendants through tested head `d804d846e` pass 201/201 with zero skips; repository validation remains from the preceding runtime-equivalent rebase. The queue closes with Behind the patrol and Side-door bays retained as open lessons. Hosted qualification remains. |

After the earlier v0.132.5 main rebase, an uncontended bounded host rerun passed all selected corrected cases:
four Solo scenarios, four Versus scenarios, two representative Team source routes and the three-stage
Solo → Versus → Solo restoration. The test runner recorded 14 passing test/subtest records and no
failures. The earlier two chooser-opening timeouts occurred while another worktree continuously used
a CPU core; they were not changed-expectation failures. The full long host suite remains unrun.

PR #650's exact rebased head passes **79/79 with zero skips** across current/default Team entry,
handoff and library behavior, both cultural editions, isolated progress, safe openings, alternate
routes across presets and seeds, no-Support partner exchanges, pinned full clears, preserved impact
editions, Studio and cross-campaign Next. It does not replace physical devices, public frozen-build
checks or human balance review. The current v0.141.0-based v32 head separately has a fresh 201-test
route/bootstrap/navigation rerun.

The second Team slice now has **13/13** focused checks. Every changed mission keeps one connected
field, idle-safe starts on all presets, two distinct no-down approaches, and a two-closure exchange
where the second pilot traverses the first pilot's reclaimed route without cutting or using Support.
Fresh input-only searches also found full clears on every preset; Standard routes are pinned at
33.8-52.2 seconds with both pilots contributing, no downs and no Support. This proves bounded route
feasibility and rules out a mandatory late-cleanup tail in those fixtures; it does not prove fun.

The three completion batches immediately after Relay also have fresh exact-current-head evidence:
Crosswind passes **159/159**, Fracture/Apex passes **162/162**, and Neon passes **165/165**, all with
zero skips. These cohorts cover both authored approaches across presets, control styles and seeds,
safe openings, replay-stable Versus parity and the shared route/bootstrap/host integration. They do
not replace hosted gates, long suites, production builds, public frozen-build checks, physical
devices or human balance and cultural review.

The remaining completion tips are likewise qualified locally on their exact current source: Rover
passes **156/156** and Border passes **170/170**, both with zero skips. The final Border
frontier/pocket top passes **201/201** through its plan-only descendant; its runtime source remains
`d35810836`. Together these receipts close the local focused candidate/route/bootstrap/host queue
for v26-v32. Hosted gates and every wider evidence boundary above remain open.

## Remaining implementation and ETA

Effort starts when the item has an uncontested release or implementation slot. GitHub runner,
large-asset and archive delays are outside these estimates.

| Priority | Remaining item                          | Exit condition                                                                                                                                                                                       |                                                    Indicative effort |
| -------: | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------: |
|        0 | Hosted exact-head qualification         | Run the focused hosted gates on the rebased tips and preserve truthful skipped-suite boundaries                                                                                                      |                                      **2–6 hours per bounded batch** |
|        1 | Promote the cultural Journey chain      | Review/merge in dependency order, immutable release and public play for each accepted batch                                                                                                          |                               **1–2 working days per release batch** |
|        2 | Complete second Team slice and fixtures | Review PRs #650/#651, immutable public delivery and frozen-build checks; source wiring and bounded runtime/host verification are complete                                                            |                                     **3–6 hours** plus release queue |
|        3 | Team continuation and qualification     | Review/publish rebased PR #657; paired-board fairness, controller/touch/keyboard, cross-campaign Next, Skip, reload/Continue and public frozen-build proof                                           |                      **8–16 hours** plus release queue/device access |
|        4 | Whole-Journey accessibility/performance | The spatial disposition queue is resolved with two intentional open lessons retained. Remaining work is reduced effects, contrast, small-screen, startup/performance and deterministic qualification | **2–4 working days** for accessibility and performance qualification |
|        5 | Human balance and cultural review       | Understandable failures, distinct missions, enjoyable retries, Team cooperation quality and cultural review by people                                                                                |                   **1–2 days synthesis** after testers are available |

Versions through v0.141.0 are now occupied by accepted releases. Cultural draft labels do not
reserve a release number; the sole publisher assigns versions from the accepted predecessor when a
batch is actually promoted.

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
   patches and active task data were preserved. Free space is now about 2 GiB. Avoid duplicate
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
    Its exact-current-head 156/156 zero-skip cohort does not establish enjoyment or cultural
    approval.
11. **v27 remains opt-in:** PR #665 registers a separate v27 review identity while keeping v25 as
    default. Its exact-current-head 159/159 zero-skip cohort passes, but it still needs hosted gates,
    review and promotion through the serialized release lane.
12. **v28 remains opt-in:** PR #666 preserves v25 as default and v27 as history. Its exact-head
    candidate/route/bootstrap/host cohort passes 162/162 with zero skips. Review, hosted
    qualification, promotion and public evidence are still required.
13. **v29 remains opt-in:** PR #667 preserves v25 as default and v28 as history. Its exact-head
    candidate/route/bootstrap/host cohort passes 165/165 with zero skips. Review, hosted
    qualification, promotion and public evidence are still required.
14. **v30 remains opt-in:** draft PR #670 preserves v25 as default and v29 as history. Its exact
    candidate/route/bootstrap/host cohort passes 156/156 with zero skips. Hosted qualification,
    review, promotion and public evidence are still required.
15. **v31 remains opt-in:** draft PR #671 preserves v25 as default and v30 as history. Its
    exact candidate/route/bootstrap/host cohort passes 170/170 with zero skips. Hosted
    qualification, review, promotion and public evidence remain.
16. **v32 remains opt-in:** draft PR #672 preserves v25 as default and v31 as history. Its exact
    v0.141.0-based candidate/route/bootstrap/navigation cohort passes 201/201 with zero skips, and
    repository validation passes. The two remaining open/plain boards are intentional accepted
    lessons, not unfinished count targets. Hosted qualification, review, promotion and public
    evidence remain.

## Immediate execution order

1. Complete hosted review for locally qualified PRs #650 and #651, then qualify PR #661's pacing
   inventory at its exact rebased head.
2. Review PRs #664-#672 in dependency order. Do not redesign Behind the patrol or Side-door bays
   merely to force a zero open/plain count; both are documented intentional lessons.
3. Review and publish the separately rebased PR #657 without entangling its Team Classic → Custom
   Next repair with the cultural release chain.
4. Promote accepted cultural releases through the sole publisher, reporting immutable release and
   actual public delivery rather than a merge or workflow start.
5. Run the remaining accessibility, compact-layout, startup/performance, physical-device and human
   balance/cultural qualification work after the source batches are frozen.

The original P13-P15 whole-Journey pacing, Team cooperation, accessibility/performance and final
human acceptance remain incomplete.
