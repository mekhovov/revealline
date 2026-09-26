# Reveal Line delivery status · 26 September 2026

This is the current execution view for the Ukrainian spatial-redesign programme and its immediate
release dependency. Older dated plans remain historical evidence, not a claim that their queued
versions or acceptance gates are still current.

## Public and release state

- Latest accepted public release: **v0.132.3**.
- v0.132.4 Team picture-preparation repair has an exact immutable production receipt and its Pages
  selector is merged. The streaming public-byte audit is still underway, so v0.132.4 is not yet
  counted as accepted public delivery here.
- PR #654 has merged the v0.132.5 source to `main` at
  `72cfc74552669699266d5d8ad92c56a69da885b2` after PR #656's fastline throughput-contract repair.
  No v0.132.5 GitHub Release exists yet; immutable assets, Pages and public acceptance remain owned
  by the publisher. A source merge is not public delivery.
- Current `main` is `72cfc74552669699266d5d8ad92c56a69da885b2`. All nineteen cultural branch
  tips were guarded-pushed atomically onto that commit with an equal 67-commit count. Sixty-six
  commits range-diff one-to-one; the only expected delta changes the first candidate version's
  predecessor from 0.132.4 to 0.132.5 while preserving its 0.138.0 target. The
  v0.149.0 successor is draft PR #650 at
  `7b7f23a00efd4d4e68fdc624ac5aa820ffda9cdc`; the test/documentation reconciliation is draft PR
  #651. Independent ready PR #657 is rebased directly on current `main` at
  `6459e8fbc2e11f0c3bd6d735885c674c9e7295b8`. The dirty root checkout was not changed.

## Completed source work

| Scope                                            | State                         | Evidence boundary                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Journey Ukrainian spatial stack v12-v24          | Rebased and pushed            | Candidate source only; each draft PR still needs its own promotion and public verification.                                                                                                                                                                                                         |
| Apex v25 / PR #625                               | Clean draft, source `0.140.0` | Earlier focused and production-build evidence exists; the exact terminal-base head still needs release CI.                                                                                                                                                                                          |
| Complete Team adoption / PR #630                 | Clean draft, source `0.141.0` | Complete twelve-mission Team edition is wired as current in the candidate stack, with older editions preserved.                                                                                                                                                                                     |
| First Team Ukrainian slice / PR #636             | Clean draft, source `0.142.0` | Three redesigned identities, 78/78 focused integration evidence, earlier production build; not public.                                                                                                                                                                                              |
| Second Team Ukrainian slice / PR #642            | Clean non-default draft       | Crossed gardens, Split orchards and Weaver crossing redesigned copy-on-write; no selector/default/version change yet.                                                                                                                                                                               |
| Second Team current edition / PR #650            | Clean draft, source `0.149.0` | Default/previous edition, Team library, Studio, exact Next, isolated progress and EN/UK wiring; earlier focused cohort 83/83 and localization validation pass; latest-main exact-head runtime cohort passes 54/54 with zero skips at `7b7f23a00efd4d4e68fdc624ac5aa820ffda9cdc`; not public.        |
| Unified-library fixture reconciliation / PR #651 | Clean draft, test/docs only   | Confirms 91 current + 48 prior Journey + 188 Classic = 327 unique rows and updates stale 201/279 and `whole-spatial-v5/v6` expectations to current v25 ownership.                                                                                                                                   |
| Team opaque-owner continuation / PR #657         | Ready isolated hotfix         | Shared Next no longer JSON-parses opaque Team Classic owner IDs; Current/Original lanes remain separate and Classic → Custom continuation is restored. Exact current-main continuation/localization/impact cohort passes 27/27 at `6459e8fbc2e11f0c3bd6d735885c674c9e7295b8`; not merged or public. |

After the final main rebase, an uncontended bounded host rerun passed all selected corrected cases:
four Solo scenarios, four Versus scenarios, two representative Team source routes and the three-stage
Solo → Versus → Solo restoration. The test runner recorded 14 passing test/subtest records and no
failures. The earlier two chooser-opening timeouts occurred while another worktree continuously used
a CPU core; they were not changed-expectation failures. The full long host suite remains unrun.

The latest-main exact-head lightweight runtime cohort passes **54/54 with zero skips** at PR #650.
It covers default Team entry, handoff/return validation, both cultural topology/route editions,
isolated progress, preserved impact/complete-specialist editions and cross-campaign Next. It does
not replace the heavier chooser-host rerun, physical devices, public frozen-build checks or human
balance review.

The second Team slice now has **13/13** focused checks. Every changed mission keeps one connected
field, idle-safe starts on all presets, two distinct no-down approaches, and a two-closure exchange
where the second pilot traverses the first pilot's reclaimed route without cutting or using Support.
Fresh input-only searches also found full clears on every preset; Standard routes are pinned at
33.8-52.2 seconds with both pilots contributing, no downs and no Support. This proves bounded route
feasibility and rules out a mandatory late-cleanup tail in those fixtures; it does not prove fun.

## Remaining implementation and ETA

Effort starts when the item has an uncontested release or implementation slot. GitHub runner,
large-asset and archive delays are outside these estimates.

| Priority | Remaining item                                | Exit condition                                                                                                                                          |                                                                       Indicative effort |
| -------: | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------: |
|        0 | Finish the v0.132.4/v0.132.5 publication lane | Confirm v0.132.4 public-byte acceptance, then immutable v0.132.5 release, Pages and bounded public proof without mixing in release-optimization changes | Source is merged; **2–8 hours** for immutable packaging, Pages and bounded public proof |
|        1 | Promote the cultural Journey chain            | Review/merge in dependency order, exact-head qualification, immutable release and public play for each accepted batch                                   |                                                  **1–2 working days per release batch** |
|        2 | Complete second Team slice and fixtures       | Review PRs #650/#651, immutable public delivery and frozen-build checks; source wiring and bounded runtime/host verification are complete               |                                                        **3–6 hours** plus release queue |
|        3 | Team continuation and qualification           | Review/publish PR #657; paired-board fairness, controller/touch/keyboard, cross-campaign Next, Skip, reload/Continue and public frozen-build proof      |                                         **8–16 hours** plus release queue/device access |
|        4 | Whole-Journey pacing and accessibility        | Campaign-to-campaign pressure audit, reduced-effects/contrast/small-screen/performance and deterministic compatibility                                  |                                                                    **2–4 working days** |
|        5 | Human balance and cultural review             | Understandable failures, distinct missions, enjoyable retries and cultural review by people                                                             |                                      **1–2 days synthesis** after testers are available |

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
6. **Disk pressure:** 793 MiB of additional old caches containing only recoverable source archives,
   dependencies, logs and test artifacts was removed after checking for Git repositories, patches,
   published release assets and active processes. Roughly 1.4 GiB remained after each reclamation.
   Avoid duplicate local builds and never remove unpushed source, user media or another task's active
   workspace. Free space is now about 1.1 GiB, so duplicate production builds remain unsafe.
7. **Host performance:** the uncontended PR #651 scenarios pass, but individual chooser paths took
   about 5.5–30.6 seconds in the fixture harness. This closes the corrected-assertion gap, not the
   broader startup/performance qualification.
8. **First cultural gate:** PR #530's earlier focused run passed all forty selected route checks and
   seven of eight controller-host scenarios. The Solo compact-filter scenario failed one focus-state
   assertion while paired Versus and Team scenarios passed; that exact case then passed locally in
   8.7 seconds. A subsequent hosted rerun was cancelled when `main` advanced, not completed. A fresh
   run for exact rebased head `726b90d675eb8f733ccb66620d0e2f3eb4a96e70` is queued; no cancelled
   run is represented as a pass.

## Immediate execution order

1. Let the sole publisher finish immutable v0.132.5 assets, Pages and bounded public acceptance;
   keep any further release-throughput experiments out of that publication path.
2. Qualify and publish isolated PR #657 after the active release lane; do not wait for the full
   cultural stack to restore Team Classic → Custom Next.
3. Finish PR #530's exact-head hosted focused rerun at `726b90d675eb8f733ccb66620d0e2f3eb4a96e70`.
   Its previously failing Solo compact-controller case passes locally, while the earlier hosted
   failure and rebase-cancelled rerun remain recorded.
4. Keep the rebased cultural PR chain clean and reviewable while the public release lane completes.
5. Review and qualify the bounded v0.149.0 PR #650 at its exact head.
6. Review draft PR #651 and publish the isolated library-fixture reconciliation after its focused
   duplicate/ownership audit.
7. Promote cultural releases in dependency order, reporting actual public delivery rather than a
   merge or workflow start.

The original P13-P15 whole-Journey pacing, Team cooperation, accessibility/performance and final
human acceptance remain incomplete.
