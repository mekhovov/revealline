# Flight practice: status review and remaining plan — 19 October 2026

## Current decision

The implementation is substantially complete and all three development packages
are locally playable. **The normal production build and current local browser
journeys now pass. The full plan is not complete:** recovery coverage,
native cancellation timing, remote CI and real acceptance decisions remain open.
Hosting, physical hardware and the historical World active-session check remain
explicitly deferred by the owner.

This review supersedes earlier queue, resource and next-step statements. Exact
results and preserved failures are in the
[execution report](flight-practice-execution-2026-10-19.md). No older receipt is
relabelled as a test of newer code.

## Completed in the latest continuation

- Accepted main `36e8bc426` is integrated; all 33 Practice patches rebased
  identically. The shared dirty primary checkout and unmerged SIM work remain
  untouched. Candidate source is `08fc3430c8`; observer/full-site/test source is
  `bcc0b61a8cbc984f075fae1260b899fb1b78ff1d`.
- All three packages reproduce twice and pass strict admission. The candidate
  envelope is `61ae470760baa9f276a0d6c9c22a3f536e4e5de8048246e454c07ef0e56e7270`.
  They remain development `v0.151.1`, not public-eligible; all 24 reviews are pending.
- The normal full build passed in **277.874 seconds**, with unchanged production
  concurrency and 600-second limit. All 4,431 input pins stayed unchanged. The
  output has 3,560 manifest files / 1,074,765,329 bytes. This is a local build,
  not an assembled hosted-capacity approval.
- **1,278 Practice tests passed** in 488.397 seconds. **757 local-interface tests
  passed** in 203.549 seconds. No skips, failures or deadline changes. The first
  interface attempt stopped before tests because sparse checkout omitted committed
  evidence. Restoring that exact tracked source fixed setup; all 44,923 raw tracked
  files and modes were verified. Its failed receipt is retained.
- All six EN/UK full-production directory → one Play → disarmed Home → packaged
  guide → return journeys passed. Production files and package overlays were
  independently rehashed. A blocked root `/favicon.ico` request is retained as a
  fixture-boundary warning, not hidden or called an error-free run.
- Ten beginner exercises passed with actual public exports and independent
  replay: two Gym and eight Academy/World EN/UK Self-level/Acro cases.
- All six current restarted-offline launcher/installed-window short flights
  passed. Actual imported CC0 World content survived; owned test apps were removed.
- Current Gym and Academy historical-version update sessions passed: real focus
  loss paused the flight, focus return did not resume it, and explicit resume
  continued motion without replacing the document. Historical World remains D3.
- Current Academy recovery passed: an actual earned proof was exported, native
  browser quota eviction removed its database and caches, ordinary preparation
  and import restored the proof, independent replay verified it, and a fresh
  offline browser process completed a short lift and pause.

Existing completed implementation remains: descriptor-driven three-card discovery,
EN/UK player/maintainer guides, precise offline states and scoped removal, stable
launchers, v1 fallback, last-known catalogue handling, package preflight/publishing
tooling, and the unpublished fourth-app add/update/rollback/retirement recipe.
Earlier tuning-library restore evidence remains source-specific; it is not
whole-origin-loss qualification of every backup type.

### World recovery follow-up — incomplete

Three bounded attempts stopped before native eviction: hidden offline control,
then a mismatched completion-message expectation, then a hidden Content & Offline
tab during editable-project setup. The third attempt completed, exported and
independently replayed a real World lesson first. All three owned browsers,
servers and disposable profiles were cleaned up; no user profile was touched.
These are observer failures, not a World recovery pass or a diagnosed simulator
bug. Further retries are paused for approach review after repeated failures.

## Remaining plan and priorities

Estimates are focused effort **after prerequisites**, not promised dates. Queue
time, reviewer availability and new defects are excluded. There is no defensible
overall completion date.

| Priority      | Remaining item and exit evidence                                                                                                                                                                      | Why / impact of omission                                                                                   | Estimate and dependency                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 / R1       | Required remote CI on the actual PR head; compare later accepted changes before refreshing affected checks. Local integration and current browser refresh are complete.                               | Local passes cannot substitute for required remote jobs or qualify later SIM bytes.                        | Queue/run time unknown; fixes estimated only if a failure appears. Last snapshot: draft PR #1554 at `bcc0b61a8`, all 12 jobs queued.                      |
| P0 / R3       | Finish applicable World project/asset/record and aircraft/profile/tuning recovery with public exports/imports after actual loss, then offline play. Preserve failures and distinguish each data type. | A single Academy proof and ordinary library restore do not prove all advertised backups survive real loss. | 1–2 focused days for remaining coverage, subject to safe disposable-profile resources and maintained UI contracts. No affected-user-profile manipulation. |
| P0 / R4       | Obtain a native timing witness of Cancel while digest work is outstanding, followed by settled work and previous/sibling preservation.                                                                | Deterministic late-write tests and final-response cancellation do not establish native hash/UI overlap.    | Initial bounded trace investigation completed **inconclusive**. No honest completion ETA; a new evidence-supported method is needed before more attempts. |
| Complete / R2 | Retain current Gym/Academy update evidence; rerun only for relevant source changes.                                                                                                                   | Avoid repeated work or unsupported transfer of old results.                                                | No current rerun required. World historical subset remains owner-deferred.                                                                                |
| Complete / R5 | Retain normal production build and all six current full-production journeys.                                                                                                                          | Confirms actual built main-shell integration, not only a fixture.                                          | No current rerun required; later runtime changes require impact comparison.                                                                               |
| P1 / R6       | Agree moving-flight/menu/loading/recovery workloads and acceptance thresholds, then measure local Chrome.                                                                                             | Startup success is not evidence of smooth flight or an accepted performance budget.                        | 4–8 hours measurement after agreement; decision turnaround unknown.                                                                                       |
| P1 / R7       | Review readable 200% layout, complete visible/retained focus and actual EN/UK spoken statuses using a named screen reader.                                                                            | DOM semantics and normal-size screenshots do not prove usable zoom or spoken feedback.                     | 1–2 review/test days plus fixes; screen-reader/operator setup needed.                                                                                     |
| P1 / R8       | Real novice guide walkthroughs and a real maintainer's unpublished sample lifecycle.                                                                                                                  | Scripted success cannot establish human understanding or discover confusing instructions.                  | 0.5–1 initial review day plus scheduling/fixes; participants unassigned.                                                                                  |
| Required / R9 | Assemble final source-bound evidence and obtain eight attributable gate decisions for each app.                                                                                                       | Tests and hashes are not content, license, learning, accessibility or performance approval.                | 0.5–1 engineering day after prerequisites, plus unknown reviewer time; all 24 decisions pending.                                                          |

Recommended order: complete bounded R3 data-preservation coverage, resolve a valid
R4 measurement approach, and monitor meaningful CI outcomes; arrange R6–R8
acceptance separately, then close R9. Do not repeatedly rebase during frozen runs
or rerun already-passing unchanged cases merely because the PR is queued.

## Remaining concerns and scope limits

- Native digest probes confirmed real worker digest events, but the trusted
  cancellation happened during download and a second probe missed the brief
  verification window. Neither proves outstanding-hash cancellation. No artificial
  digest slowdown, timing waiver or false pass was introduced.
- Native quota recovery used a disposable, explicitly reduced 512 KiB browser
  pool and the normal eviction timer. It is not default-policy, whole-origin,
  every-browser or affected-player recovery. Browser-context offline is not
  machine-wide airplane mode. Shared seeded profile/proof fixtures in update
  tests remain synthetic; they do not qualify physical radios.
- The earlier full-build failures remain real evidence. A later normal local
  output pass resolves the execution blocker, not the entire SMB performance
  cause. No production thread-pool override or larger deadline was adopted.
- Local headroom recovered sufficiently for guarded runs, but remains volatile
  (approximately 3.1 GiB at the last check). The 2 GiB browser floor and normal
  build guard remain. The Mac mini share supplies storage only. No user data,
  dependencies or unrelated files were deleted.
- The separate SIM affected-profile persistence/retention incident remains
  unresolved. Fresh-profile recovery success cannot explain the original lost
  rows or confirm recovery of protected sessions. Do not clear or repopulate that
  profile. Concurrent SIM updates are not imported before acceptance on main.
- Two moderate default-branch vulnerabilities were reported by the last push;
  they are untriaged here, not attributed to Practice or claimed resolved.
- Human reviewers, accepted performance limits and actual package decisions are
  missing. Local Chrome selection does not authorize invented approvals.

## Owner-deferred items

| Item                                                                              | Consequence                                                                                                  | ETA                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| D1 — physical controller/radio/touch checks                                       | Physical input support remains unqualified.                                                                  | Unscheduled.                        |
| D2 — hosting/capacity architecture/allocation/upload/selector/public verification | Local packages are not a public release; original GitHub Pages completion criterion remains unmet by choice. | Unscheduled; no public-release ETA. |
| D3 — historical World automated active-session check                              | Do not claim all-app active-flight update safety. Current World play/offline/recovery are separate.          | Unscheduled; do not retry.          |

Full Phase 1 completion still requires actual acceptance and public delivery.
This checkpoint closes substantial **local** verification work without silently
waiving the remaining or deferred requirements.
