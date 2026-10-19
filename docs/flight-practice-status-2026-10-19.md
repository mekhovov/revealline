# Flight practice: status review and remaining plan — 19 October 2026

## Overall decision

**The feature implementation is substantially complete and the three development
packages are locally playable. Non-hosting qualification is not complete, the
draft PR is not release-approved, and public delivery is owner-deferred.** There
is no defensible overall completion date or single completion percentage.

This review is authoritative for priorities and current status. The
[19 October execution report](flight-practice-execution-2026-10-19.md) and its
hashed evidence archives remain authoritative for the original test results.
Earlier checkpoints retain their exact sources; their historical “next” steps,
storage readings and PR state are not current instructions.

This review changed documentation only. No rebase, implementation, build,
browser qualification, approval, publication or remote execution was performed.

## Fresh read-only observations

Snapshot refreshed: **19 October 2026, approximately 02:35 Europe/Berlin**. Remote state and
free space may change after inspection.

- Isolated checkout and remote PR head match:
  `1b8dcb49110cb639bb1df4e5cb4a44237eea1e53`. The checkout was clean before this
  documentation update. The concurrent dirty primary checkout remains untouched.
- [PR #1554](https://github.com/mekhovov/revealline/pull/1554) is open, **draft and
  mergeable**, with merge state `UNSTABLE`. **All 12 reported checks are queued**;
  there is no current-head CI pass, failure or complete suite result to report.
  “Mergeable” describes conflict calculation, not readiness or approval. The PR
  snapshot still names base `dd337c812`; live main below is newer, so mergeability
  against that newer revision has not been established.
- Live main is `bd15820bee10a33ba64534071d22657fbd7326d3`, **ten commits ahead**
  of the last integrated main `237b405437def3c41b01165fe057af1ab06f618c`. The
  [comparison](https://github.com/mekhovov/revealline/compare/237b405437def3c41b01165fe057af1ab06f618c...bd15820bee10a33ba64534071d22657fbd7326d3)
  lists 31 changed files, including `civilian-fpv/beginner-coach.mjs` and
  `civilian-fpv/world-app.mjs`, related tests, recording lookup and CI diagnostics.
  It also adds the optional First Flight entry on Capture Home and its checks.
  These accepted changes are **not integrated or qualified here**. Existing
  browser receipts cannot automatically qualify the new coach/World bytes.
- Approximately **1.8 GiB local free** and **52 GiB on the Mac mini SMB share**
  were visible. Output capacity on the share is adequate for the attempted local
  build. Local space is below the **2 GiB preflight floor used for the recent
  disposable browser runs**, blocking the next equivalent heavy browser check
  until headroom recovers. The recommended working margin remains 4 GiB. SMB
  storage does not move computation or browser profiles off this Mac.
- The retained candidate is source `6177d2cc83adb9cb76ff4088d502c21ddfd7d199`,
  tree `ba3902515d73e97ae18dda8ffc57ee698eba9825`, development `v0.151.1`,
  envelope `b64909c3127ea428be8d188444bf2ae0873e299b71bfd991a737ba0c658ce2a5`.
  Its existing review file was re-read: **all 24 gate decisions are pending**,
  with no reviewers or approved evidence. It is not public-eligible.

## Completed, with scope boundaries

| Area                                | Completed work / retained evidence                                                                                                                                                                                                                                                      | What this does not establish                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery and launch                | Three descriptor-driven cards with real previews, purposes, requirements, input support, version/size, EN/UK, Play/details, stable launchers, safe routes and v1 fallback. Empty/failure/retry/dated offline catalogue states are implemented.                                          | No claim that the public host currently lists or serves these packages.                                                                               |
| Offline service                     | Dependency/hash/owning-worker readiness, download/cancel feedback, inactivity/overall limits, staging isolation, previous-version preservation, rollback and scoped app removal are implemented and tested.                                                                             | Native cancellation during outstanding hashing and complete real-data loss recovery remain open.                                                      |
| Package and maintainer workflow     | All three candidate packages reproduce twice and pass original admission. Descriptor registration, preflight, preview and the existing publisher are documented. A temporary fourth app passed automated launch, update, offline reopen, rollback and retirement; it was not published. | No real-package acceptance decision or human maintainer walkthrough. `.rlpack` remains World content, not an executable directory app.                |
| Guides                              | EN/UK repository and packaged player help, separate maintainer instructions, first-flight links, backup/removal/update guidance and app-vs-content distinctions are implemented. Six current guide/navigation journeys and four populated tuning-library restores pass.                 | Not a novice learning study or loss/recovery qualification of every advertised data type.                                                             |
| Current-candidate regression checks | Source `6177d2cc8`: 1,270 Practice, 756 local-UX and 369 focused checks pass; 377 observer checks pass with one explicitly recorded historical-fixture skip.                                                                                                                            | Not fresh CI or a pass for the ten newer main commits. The Practice run took 564.626 s under its unchanged 600 s limit, leaving little timing margin. |
| Beginner play                       | Ten current native exercises with public export and independent replay pass: two Gym cases and eight EN/UK Academy/Worlds Self-level/Acro cases.                                                                                                                                        | Vertical Acro completion is not rotational proficiency, physical-controller qualification or human learnability.                                      |
| Update-session refresh              | Current Gym and now current Academy genuine old/new installed-session checks pass: trusted focus-loss pause, unchanged document, no automatic resume, explicit resumed motion and retained data witnesses.                                                                              | Historical Worlds remains D3. Seeded shared profile/proof fixtures are explicitly synthetic, not genuine lesson completion or physical-radio proof.   |
| Restarted offline play              | All six current English launcher/installed-window short-flight routes pass after an actual Chrome process restart; imported CC0 World content is retained. Both new native runs removed their owned test apps/profiles without reported cleanup errors.                                 | Browser-context offline is not machine-wide airplane mode; this does not qualify every World or browser.                                              |
| Build diagnostics and safety        | Bounded four-worker writes, shared directory creation, settling owned work on error, opt-in phase-start reporting and conservative cross-volume clone veto. All 53 targeted tests pass, as do lint/format checks. Original failed builds and diagnostics are retained.                  | No successful normal full build of the latest writer. The small overlapping ABBA comparison is not demonstrated full-build acceleration.              |

Older full-production EN/UK directory journeys and one real Academy proof
loss/recovery remain useful **partial, older-source evidence**, not absent work
and not current-payload passes. No older receipt is relabelled as latest-main.

## Remaining work, priority, impact and ETA

ETAs below mean **focused effort after prerequisites**, not promised elapsed
dates. One day is approximately eight focused hours. Queue time, owner/reviewer
availability, new defects and changes to accepted main are excluded. No deadline
or validation waiver is implied. The full-build fix has no reliable ETA.

| Priority / ID         | Remaining deliverable and exit evidence                                                                                                                                                                                                                             | Why needed / impact if omitted                                                                                                                                                                  | Estimate and blockers                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 / build            | Attribute preparation and SMB materialization cost, make an evidence-supported correction if warranted, then complete the normal full build within existing limits with unchanged input pins and original manifest/ZIP verification.                                | Without the actual current site output, its directory/main-shell integration cannot be qualified. A fixture build, isolated validator or older ZIP is not a substitute.                         | **Next diagnostic checkpoint: 2–4 h; fix/completion ETA unknown.** The instrumented `56acb4240` run reached expanded-files then timed out at 600 s. The latest `623918462` writer has no full retest. No blind retry or raised limit.                                           |
| P0 / R1               | Integrate the ten accepted main commits in isolation, compare all package inputs, reproduce/re-admit changed candidate bytes and complete required affected tests/current-head CI. Preserve older evidence and SIM ownership.                                       | Prevents shipping stale coach/World behavior or claiming that queued checks passed. Mere absence of merge conflicts does not prove compatibility.                                               | **2–4 h engineering**, then unknown CI queue/run time and any fixes. Main may move again. The older remote local-UX timeout remains undiagnosed; a newer local pass does not explain it.                                                                                        |
| P0 / R3               | Exercise actual public exports and loss/recovery for applicable records, World projects/assets, aircraft archives and advertised controller/tuning libraries; demonstrate loss honestly, reinstall, import, compare semantic identities and finish offline flights. | The existing single older Academy proof and populated tuning restores do not establish recovery of all user data. Omitting this risks misleading backup instructions and unnoticed record loss. | **1–2 focused days** after candidate freeze and safe disposable-profile resources. Use maintained SIM controls; no hidden database seeding to invent genuine records, invented Gym persistence or affected-user-profile cleanup.                                                |
| P0 / R4               | Capture native Cancel while real digest work is still outstanding; trace timing/ownership, settle work, prove no late Ready/write and preserve previous/sibling versions.                                                                                           | Held unit-test digests and cancellation of a delayed final-ready reply do not prove real browser scheduling. A race could leave incomplete data or invalidate a working installation.           | **4–8 h for a bounded investigation/test** after candidate freeze. No artificial digest delay or synthetic overlap. If natural overlap cannot be evidenced, outcome remains inconclusive, not complete.                                                                         |
| Complete / R2 refresh | Keep the audited current Gym and Academy results; compare relevant changes after R1 and rerun only where source changes invalidate them.                                                                                                                            | Avoids both repeating already completed work as absent and extending its claim to new bytes. Historical Worlds is explicitly separate.                                                          | **No remaining current-candidate rerun.** Change-driven refresh is part of integration/qualification estimates. D3 has no scheduled ETA.                                                                                                                                        |
| P1 / R5               | On the final integrated source, build the actual production site and complete all six EN/UK directory → one Play → disarmed Home → packaged guide → directory/main-game return journeys; refresh affected offline/update checks.                                    | New main-shell, package or launcher bytes cannot inherit old full-production evidence. Otherwise the real packaged player journey remains unverified.                                           | **4–8 h after the build prerequisite and final input freeze.** Six current offline routes already pass; they are not the same as the missing current production journeys.                                                                                                       |
| P1 / R6               | Agree moving-flight/menu/load/recovery workloads and accepted same-device thresholds, measure them in local Chrome, preserve failures/outliers and obtain the actual decision.                                                                                      | Startup, CPU samples or stationary callback timing cannot establish smooth rendered flight or accepted performance.                                                                             | **4–8 h measurement**, after workload/threshold agreement; setup/decision turnaround unknown. Local browser was selected, not performance budgets.                                                                                                                              |
| P1 / R7               | Review actual readable 200% layout and complete visible/retained focus; listen to EN/UK progress, failure and readiness announcements using a named screen reader; fix and recheck findings.                                                                        | DOM semantics, approximate focus geometry and cropped/blank older captures do not prove usable visual or spoken feedback.                                                                       | **1–2 review/test days plus fixes**, after screen-reader/operator setup. Physical inputs remain D1; software checks cannot approve that deferred subset.                                                                                                                        |
| P1 / R8               | Have real first-time players follow the guides and a real maintainer add/update/retire the unpublished sample; record assistance, confusion and outcomes.                                                                                                           | A script completing a lesson or sample lifecycle proves execution, not that a person understands the feature or the publication recipe.                                                         | **0.5–1 initial review day plus scheduling/fixes.** Participants/reviewers are not assigned; local-browser selection is not human approval.                                                                                                                                     |
| Required / R9         | Freeze final source-bound evidence, reconcile guides and obtain the eight actual package-gate decisions for each of three apps, with attribution and approved evidence.                                                                                             | Tests and hashes are not content/license/accessibility/performance/learning approval. All 24 decisions remain pending.                                                                          | **0.5–1 engineering day assembly** after prerequisites; reviewer turnaround unknown. Gates touching D1/D3 or other unqualified work cannot silently pass. Full approval remains unavailable until required evidence is obtained or an authorized policy decision changes scope. |

### Recommended execution order

1. **Build diagnosis and R1 first**, as independent bounded work. Do not repeatedly
   rebase while source-bound runs are active. After accepted-main integration,
   freeze exact package/observer/source identities before more heavy verification.
2. **R3 and R4 next**: prioritize data preservation and cancellation races over
   cosmetic work. They can proceed independently of the production build when
   disposable local resources and an explicit candidate are available; a queued
   PR is not a reason to stop useful local work.
3. **R5 after a successful actual build**. Reuse unchanged-byte evidence only
   after an explicit input/hash comparison; refresh affected tests, not arbitrary
   historical results.
4. **Arrange R6–R8 decisions/participants alongside engineering**, then measure
   the frozen candidate. Do not treat these acceptance dependencies as an
   unlimited implementation loop or fabricate approvals.
5. **R9 last**, while assembling evidence incrementally. Keep reviewer decisions
   pending until supported; no publication action is included.

The older **3–5 engineering-day range is not a current overall ETA**. The unknown
build fix, new accepted SIM bytes, CI queue and unassigned human decisions make
a calendar completion date unreliable. Re-estimate after the build diagnostic
checkpoint and R1, then after R3/R4 results. The estimates above describe useful
work budgets, not guaranteed successful exits from open investigations.

## Deferred items — not blockers to continuing authorized local work

| Owner decision                                                                           | Status and consequence                                                                                                                                                                                           | ETA                                 |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| D1: physical controller/radio/touch                                                      | Explicitly skipped for now; supported physical input claims remain unqualified.                                                                                                                                  | Unscheduled, owner-deferred.        |
| D2: hosting, capacity architecture, allocation, upload, selector and public verification | Explicitly deferred. Local play and a mounted folder do not make the packages publicly available. The original “three packages playable on GitHub Pages” completion condition therefore remains unmet by choice. | Unscheduled; no public-release ETA. |
| D3: historical Worlds automated active-session check                                     | Explicitly left unverified; do not retry speculative first-Arm fixes or report all-app active-flight update safety. Current Worlds beginner/offline passes remain valid for their scope.                         | Unscheduled, owner-deferred.        |

## Blockers and concerns that must remain visible

- **Full-build failure:** no adopted current output. The first run failed during
  preparation; a later instrumented run reached expanded writes. Neither fired a
  disk guard. Original-helper catalogue generation took 282.532 s in isolation;
  separate-process measurements and sampled CPU windows do not establish the
  entire timeout's cause. No validated full-build speedup is claimed.
- **Local resource pressure:** approximately 1.8 GiB local free is below the
  recent disposable-browser preflight floor of 2 GiB and the recommended 4 GiB
  workspace headroom. Equivalent heavy browser checks must wait for safe local
  space. The share supplies output space, not a
  fast local disk or remote CPU. Recheck system/profile space before heavy cases;
  no destructive user cleanup or remote access is authorized.
- **Timing/CI uncertainty:** 12 current checks are queued. The older remote
  local-UX timeout is still unexplained, and the current-candidate Practice run
  had only about 35 s margin under its 600 s ceiling. Do not waive the deadline
  or turn a queued/skipped/incomplete job into a pass.
- **Moving accepted SIM source:** the ten new main commits include simulator
  files. Integrate accepted main only; do not copy active SIM worktrees or change
  mechanics/training/rendering in this workstream. Hash-bound old evidence must
  remain tied to its actual package.
- **Separate unresolved archive-retention incident:** the
  [SIM retention report](fpv-archive-retention-followup-20261018.md) remains open.
  Six protected sessions have not been confirmed recovered; reconnect/UI fixes
  do not explain the disappearance of 16 cached rows. Fresh-profile tests do not
  diagnose that affected profile. Stop destructive cleanup there; use disposable
  R3 records. This concern affects confidence in user-data safety and must stay
  visible even while directory work proceeds.
- **Human and policy dependencies:** no accepted performance limits, named
  novice/maintainer participants or completed content/license/package decisions.
  Hardware deferral does not implicitly waive a release gate. Eight gates ×
  three packages remain 24 real decisions, not 24 tasks an automated script can
  sign for people.
- **Public availability not assessed here:** no fresh public-host request,
  release selection or capacity approval was performed. Earlier hosted-capacity
  concerns remain historical warnings, not a current site-size measurement or an
  invitation to choose a hosting architecture.
- GitHub's last push notification reported **two moderate default-branch
  vulnerabilities**. They were not triaged in this workstream; this review does
  not identify them as introduced by Practice or claim they are resolved.

## Definition of done for the current scope

An **authorized local-software checkpoint** needs a frozen accepted-main
candidate, complete required current-head CI, successful normal production build
and relevant production journeys, and honest outcomes for R3/R4 with no unresolved
blocking data-loss/startup/installation defects. It must retain explicitly
unverified acceptance/deferred items, not label the full original plan complete.

**Full release/Phase 1 completion** additionally requires the actual review gates
and the original public delivery criteria. Those cannot be claimed while D2 and
required hardware/historical/acceptance evidence remain deferred or missing.
