# Flight practice: status, remaining work and estimates — 18 October 2026

> **Authoritative current review, 19 October:** [status, completed work, remaining items, estimates and blockers](flight-practice-status-2026-10-19.md).
> Current Academy continuity and six restarted-offline routes pass; 53 targeted
> build-tool checks pass. The normal full build still times out, latest observed
> in expanded-file writing. PR #1554 is draft/mergeable with 12 queued checks;
> ten newer main commits are not integrated. Everything below is historical,
> not a current integration, storage, browser, CI or approval claim.

> **Latest:** [accepted main 237b40543: verified work, blockers and remaining estimates](flight-practice-execution-2026-10-18.md).
> Source `6177d2cc8` passes 1,270 Practice and 756 local-UX tests, fresh package
> admission, ten native exercises, current guides/backups and Gym continuity.
> Current full production and heavier follow-ups are storage-blocked (~1.7 GiB
> free versus a ~3.2 GiB start guard). Hosting/hardware/historical Worlds are deferred.
> The rest of this file is the preserved earlier review, not current execution status.

> **Superseded execution status:** the [integrated execution checkpoint](flight-practice-execution-2026-10-18.md)
> records the completed rebase, 1,232 Practice passes, current production build,
> six restarted-offline routes, corrected backup guides and native tuning restores.
> It also records the still-failing historical Worlds preparation and updated
> remaining work. The read-only review below is retained as history; its stale
> source, disk readings and integration blockers are not today's execution state.

This is the current planning checkpoint. It supersedes historical “next” and
priority statements in the completion plan, continuation and release checklist;
it does not supersede or re-label their original evidence. This review changes
documentation only. No rebase, simulator change, new qualification run, review
approval or publication was performed.

## Overall status

The three-app directory, launchers, installation service, guides and maintainer
workflow are implemented and have substantial source-bound verification. The
non-hosting qualification is **not complete**, and the current PR is **not ready
to merge**. Public availability is a separate, explicitly deferred outcome.
Do not report a completion percentage: implementation, source-specific evidence,
human approval and public delivery are different completion states.

### Fresh repository and automation findings

- Isolated local checkout: `b012f2a9da0e572f6d77d39add4d71f692388dbb` on
  `codex/flight-practice-pointer-acceptance-20261015`, initially clean.
- [PR #1554](https://github.com/mekhovov/revealline/pull/1554) remains open and
  draft at `4768988fb5f91b915f825ccd983b88600160b32b`. GitHub reports
  `CONFLICTING` / `DIRTY`, not merge-ready. The local branch has not incorporated
  that newer remote head. Preserve it before integrating main; do not force-push
  the old checkout over newer work.
- A read-only remote check found main at
  `20555cda6bd44a0736aa829e64c52e455b4e770c`. The compare API reports 620
  main-only commits and 18 PR-only commits. This is a moving snapshot, not a
  guarantee that main will remain fixed or that every commit affects Practice.
  The PR metadata separately reported base `fe1bb1ce…`; do not confuse a cached
  mergeability/base snapshot with the subsequent live remote ref.
- The remote completion-plan blob matches the local pre-edit plan exactly:
  `2bda8f2bde234efbca7521e30953e0a73b539b9a`. The update below therefore does
  not assume that an unseen newer plan already closed the listed gaps.
- At that PR head, 12 checks succeeded, one failed and two were skipped.
  Successful checks include optional-practice, candidate, focused and the
  gameplay/creator/presentation/recordings/rooms feature lanes. The jobs named
  `test` and `build` were skipped; the green `release-ready` job does not turn
  them into completed full-suite/build evidence.
- [The failed local-UX check](https://github.com/mekhovov/revealline/actions/runs/39074980587/job/117520141700)
  has an original receipt with `deadlineMs: 600000`, `timedOut: true`,
  `passed: false`, unchanged source/test files, and no complete TAP totals. Its
  log ends after top-level `ok 674`; it has no top-level `not ok` result or final
  summary. That is a suite timeout, **not a diagnosed product assertion failure**
  or proof that all selected tests finished. The hanging/slow case, resource
  pressure or cleanup cause remains unconfirmed. Do not simply increase the
  deadline to get a green result.
- The [original failed-check ZIP](flight-practice-status-20261018-local-ux.zip)
  is 34,967 bytes, SHA-256
  `ba855607ab80421cb3fb76fa3a44ca08e82cf86723f4b4bc75fc1130e800a021`.
  Its three original members include the receipt, TAP and run metadata. Source
  identity is the remote PR head above, not local `b012f2a9da`.
- Storage was rechecked: about **13 GiB free locally**, **58 GiB** on the external
  staging volume. The previous exhausted-disk blocker is no longer present at
  inspection. No fresh fetch/build was attempted in this review, so its recovery
  is not yet verified under load. Recheck before large writes; do not delete user
  data, retained evidence or previous packages to make space silently.
- The primary checkout contains substantial concurrent edits and generated
  content. It was inspected read-only and left untouched. Continue in the
  isolated Practice checkout; integrate accepted SIM work through main only.

## Completed, with explicit scope

| Area                             | Completed implementation and retained verification                                                                                                                                                                           | Boundary                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Discovery and play               | Three descriptor-driven cards, actual previews, purpose/inputs/requirements/version/size, Play/details, EN/UK, stable launchers, v1 compatibility and safe destinations                                                      | Not a current public-host availability claim                                                             |
| Main-game journey                | Six EN/UK original-production directory → one Play → disarmed app Home → guide/return routes; all 3,493 original build members checked before/after                                                                          | Production source is `3a1b5e3c3`, not latest main                                                        |
| Offline service                  | Dependency/hash/worker readiness, progress/cancel, inactivity/overall bounds, previous-version preservation, scoped removal and actionable localized failures                                                                | All-app active-flight safety and remaining native recovery cases are still open                          |
| Actual offline use               | All six stable-launcher/installed-window restarted-offline short-flight routes on the `1b339bfe6` candidate; imported World content retained                                                                                 | Scoped app/routes, not all worlds, browsers or physical devices                                          |
| Updates and failures             | Genuine all-three historical migration/rollback and three actual five-minute timeout/retry/removal cases; Academy ordinary-browser and installed-PWA active-session continuity                                               | Exact old/new bytes differ by receipt; Gym/Worlds active-flight continuity is not established by Academy |
| FPV interaction                  | Maintained visible HUD repair, result-action repair and eight EN/UK Self-level/Acro beginner exercise/export/replay journeys                                                                                                 | Not human learning or later SIM-version qualification                                                    |
| Guides                           | EN/UK repository and packaged HTML help, synchronized menu labels, explicit app-vs-`.rlpack` and offline-vs-home-screen distinctions; latest guide-only candidate reproduced/admitted and six guide/navigation routes passed | Not a novice walkthrough or complete new flight qualification for that guide-only candidate              |
| Maintainer workflow              | Descriptor/dependency registration, preflight/preview, existing publication tools and temporary fourth-app lifecycle through update/offline/rollback/retirement                                                              | Sample is unpublished; no competing publisher or real-package approval                                   |
| Software accessibility subset    | Six EN/UK native zoom/keyboard/return routes, 66 sampled focus witnesses under the explicit fractional geometry policy, reduced-motion software checks                                                                       | Cropped/blank captures do not prove visual readability, full focus outlines or screen-reader speech      |
| Regression evidence              | Last recorded local checkpoint: 402 Practice passes; 370 observer passes plus one explicit historical-fixture skip                                                                                                           | Historical `b012` checkpoint, not a newly executed latest-main suite                                     |
| Eviction/cancellation groundwork | Browser-managed eviction of a disposable fixture; deterministic pending-digest cancellation and native final-ready-response cancellation                                                                                     | Not actual app backup recovery or native hashing-in-progress timing                                      |

Evidence and exact sources remain in the
[continuation](flight-practice-continuation-2026-10-16.md) and
[acceptance checklist](flight-practice-release-checklist-2026-10-15.md).
The latest guide-only candidate is source `11aa29782`, envelope `4258044c…`,
development identity `v0.151.1`, `publicEligible: false`. No actual public release
was allocated or selected by this workstream. Public catalogue contents were not
rechecked during this status review.

## Remaining work and estimated effort

Estimates are **focused engineering/reviewer effort**, not elapsed promises or
scheduled completion dates. One working day means roughly eight focused hours.
They assume a stable integrated source, working test access, sufficient disk and
no substantial newly discovered simulator regressions. Integration estimates
have low confidence because main and SIM continue changing. Do not add the human
waiting time into a fictional fixed release date.

| ID / priority                               | Remaining item and completion evidence                                                                                                                                                                                                                             | Why / impact if omitted                                                                                                                                  | Effort / dependency                                                                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 — P0, first                              | Preserve remote head, integrate current main in isolation, resolve conflicts, diagnose the timed-out local-UX lane and rerun affected regressions to complete summaries                                                                                            | Otherwise new work rests on stale code and the PR remains unmergeable; the timeout may conceal unfinished tests                                          | **1–2 days initially**; re-estimate after conflict/timeout triage. Diagnosis is open; no permission to relax tests or deadlines                                                                               |
| R2 — P0                                     | Extend the existing finite active-session observer to Gym and Worlds using genuinely different admitted old/new packages; witness real lift, trusted focus-loss pause, unchanged document, stable paused state, explicit resume and exact applicable retained data | Academy alone cannot prove all-app update safety; forced reload or lost state could interrupt a flight                                                   | **6–12 hours**, after R1 and exact candidate freeze. Reuse SIM interfaces, not a new training runner; Gym's completion set is memory-only                                                                     |
| R3 — P0                                     | Export actual app data through public controls, witness browser-managed origin eviction, honestly observe offline failure, reinstall and import/reverify external backups; compare stable semantic identities and re-export/replay                                 | Cached-app removal and controlled quota denial are not origin loss. Without this check, recovery instructions could promise records that no longer exist | **1–2 days**, after R1/candidate freeze and safe disk conditions. Stop if persistence prevents eviction; no user-profile clearing, fabricated data or invented Gym restore feature                            |
| R4 — P0                                     | Native cancellation while verification is genuinely outstanding, with recorded timing; settle all work and confirm no late ready/write, preserved old/unrelated versions and clean staging                                                                         | Unit-held digest results and final-ready-response cancellation do not prove native scheduling/UI timing                                                  | **4–8 hours**, after R1. If real hashing cannot be observed reliably, record the case as inconclusive rather than relabel an injected delay                                                                   |
| R5 — P1, required integration proof         | Build current integrated production output, reproduce/admit all three packages, compare changed inputs and rerun affected EN/UK directory/offline/update/guide routes                                                                                              | Older source receipts cannot qualify new launcher, worker, main-shell or simulator bytes                                                                 | **4–8 hours**, after R1 and relevant R2–R4 fixes; large I/O/disk margin required. Reuse unchanged-byte evidence only with explicit comparison                                                                 |
| R6 — P1, acceptance dependency              | Agree representative moving-flight/menu/load/recovery workloads and same-device budgets with the SIM/product owner, then measure current packages and retain outliers                                                                                              | Startup and stationary callback checks cannot establish acceptable frame pacing or a performance approval                                                | **4–8 hours measurement**, plus workload/budget preparation; **calendar ETA unknown until budgets/setup are accepted**                                                                                        |
| R7 — P1, acceptance dependency              | Review readable layout and complete focus at actual zoom; listen to EN/UK progress/error/readiness with a named screen reader; repair/recheck findings                                                                                                             | DOM semantics and approximate border geometry do not establish visual or spoken usability                                                                | **1–2 review/test days** once setup/operator is available, excluding remediation; calendar ETA unassigned                                                                                                     |
| R8 — P1, people needed                      | Real first-time-player/guide walkthroughs and a maintainer following the fourth-app recipe; record confusion, assistance, outcomes and current permitted screenshots                                                                                               | Scripted completion proves execution, not understanding or learnability; undocumented maintainer steps may remain                                        | **0.5–1 day for an initial review batch**, plus participant scheduling and resulting fixes; no invented participant count or approval                                                                         |
| R9 — Required review, not an automatic pass | Freeze final evidence and obtain the existing eight actual gate decisions for each of three packages: 24 attributable decisions, with exact source/hash, content/license checks and approved evidence                                                              | Reproducibility and green CI are not content, license, hardware, learning or package sign-off                                                            | **0.5–1 engineering day** for evidence assembly after prerequisites; **review turnaround unknown** until reviewers accept scope. Hardware-dependent decisions cannot silently pass while hardware is deferred |
| D1 — Owner-deferred                         | Physical controller/radio/touch calibration, disconnect/reconnect and safety matrix                                                                                                                                                                                | Promised physical inputs remain unqualified                                                                                                              | **No scheduled ETA**. Resume only when the owner lifts the deferral and supplies devices/operators                                                                                                            |
| D2 — Owner-deferred                         | Hosting/capacity choice, exact combined retained-site inventory, release allocation/upload/selection and public end-to-end verification                                                                                                                            | Local completion does not populate the public directory or satisfy the original GitHub Pages release criterion                                           | **No scheduled ETA**. No hosting/provisioning/publication action is authorized by this review                                                                                                                 |

Recommended sequence: **R1 → freeze exact candidate → R2/R3/R4 → R5**, with
R6 workload decisions and R7–R9 scheduling prepared independently. Avoid repeated
large rebuilds while the integrated source is still changing. Current non-hosting
software planning range is approximately **5–9 focused working days**, including
integration uncertainty but excluding reviewer/device/owner waiting and major
new defects. This is **not an ETA for full Phase 1 or a public release**. Re-estimate
after R1; do not promise a calendar date from this range.

## Blockers, concerns and decisions needed

1. **Confirmed integration blockers:** conflicting draft PR, stale local branch,
   incomplete timed-out local-UX lane. Get the newer remote work before editing
   overlapping files. No rebase or timeout fix was attempted in this report.
2. **Resource concern, no longer an exhausted-disk stop:** 13 GiB local free is
   a point-in-time reading. The repository and full build are large; use a
   measured workspace/staging plan and check free space before each batch.
   Previous low-disk eviction evidence retains that confounder permanently.
3. **Concurrent SIM/main changes:** accepted main commits can change runtime
   contracts and invalidate selected evidence. Do not copy unmerged files, alter
   the dirty primary checkout or claim old package hashes qualify new bytes.
4. **Performance decision:** owner/SIM must accept workloads, target setup and
   budgets before performance acceptance; this review invents no thresholds.
5. **Human/reviewer dependencies:** novice participation, spoken-assistive review,
   content/license decisions and actual package sign-off need named people.
   Existing checklist records the 24 decisions as pending; this review grants
   none. Physical deferral does not waive the existing publishing policy.
6. **Known coverage limits:** native hashing-in-progress remains unproven; the
   eviction capability used a tiny fixture/reduced pool, not app restoration;
   native zoom screenshots were not accepted as visual proof. Earlier intermittent
   failures remain retained, not explained away by later passing retries.
7. **Artifact durability:** `/tmp` paths are capture-time provenance, not durable
   evidence locations. Use committed originals/archives or verified retained
   staging copies, and verify their availability before rerunning. Final public
   evidence requires separate publication/privacy approval.
8. **Deferred delivery boundary:** software may reach a non-hosting checkpoint
   while full release remains incomplete. Do not silently reopen hosting or
   physical testing, raise capacity guards, omit retained versions or invent
   approvals to make the completion label green.

Prior research still supports explicit safe-time updates and external backups:
[PWA update guidance](https://web.dev/learn/pwa/update) and
[origin storage/eviction behavior](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
Storage Buckets are a possible later feasibility study, not a migration promised
by this plan. No marketplace/search/rating/new-training scope is added.

## What changed in this review

- Replaced the obsolete “disk exhausted” current blocker with measured resource
  risk; retained the historical failed fetch honestly.
- Added current remote divergence/conflict and the original CI timeout diagnosis
  boundary ahead of qualification work.
- Separated completed implementation from exact-source passes, missing native
  cases, human acceptance and owner-deferred delivery.
- Added effort ranges, dependencies and explicit unschedulable calendar ETAs.
- Preserved every historical receipt and original source identity. This report
  adds no test pass, public eligibility or reviewer signature.
