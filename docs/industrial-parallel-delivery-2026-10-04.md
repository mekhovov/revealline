# Parallel industrial delivery — 4 October 2026

This continuation follows the user request to research the plan, implement independent features in parallel, and produce tested stacked PRs. It supersedes the automated-suite waiver for new work. It does not approve the Phase C artwork or turn optional scope into a release requirement.

## Review findings and adopted improvements

1. **Recordings and network recovery need different evidence.** Retain v1 exact-state replay semantics and v2's explicit terminal-outcome contract. Cross-runtime outcome equality cannot qualify network checkpoints or identical continuous trajectories. Factorio's ARM/x86 port needed deliberate work on floating-point behavior; a successful desktop run is not cross-platform proof. [Factorio developer account](https://factorio.com/blog/post/fff-370).
2. **Network tests must cover time and ownership, not just happy-path messages.** Verify duplicate/out-of-order commands, delayed responses, liveness expiry after a stalled service, fresh readiness, event deduplication and terminal results. State synchronization needs explicit sequence handling and authoritative state; display interpolation must not alter physics or accepted outcomes. Keep existing transport until evidence justifies changing it. [State synchronization](https://gafferongames.com/post/state_synchronization/).
3. **Back navigation must suspend and reopen resources.** Preserving a permanently closed owner is wrong, but keeping all database/network connections open can also prevent caching. Close underlying connections on pagehide/freeze and reopen once on pageshow/resume, retaining the draft and rejecting stale asynchronous launches. Record actual `pageshow.persisted` evidence separately from ordinary Back success. [Browser lifecycle guidance](https://web.dev/articles/bfcache).
4. **Cancellation must complete for the caller even when a codec stalls.** Keep resource reservations until a late decode is safely discarded, but let a retired preview stop waiting immediately. Account for active, in-flight and retired-but-not-yet-released work across both boards. This is our application of bounded ownership, not a claim that cancellation stops the browser's decoder.
5. **A phone screenshot is not an input qualification.** Keep visible Pause, compact default controls and optional advanced choices. Test orientation, enlarged text, inactive spacing, simultaneous seat ownership and real physical targets. CSS pixels alone do not establish physical touch size. [Xbox touch and input guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107).

These recommendations improve delivery reliability without changing the approved gameplay, adding executable custom AI, or importing third-party artwork.

## Dependency graph and parallel streams

Implementation can proceed concurrently in separate file ownership areas. Commits and PR publication are serialized so each child names an immutable reviewed parent; no force-push, merge or auto-merge is required. Existing chain: #997 → #1000 → #1023. New review changes stack above #1023. Reconcile against latest main before integration, rather than claiming the stack is deployed.

| Stream                              | Work and acceptance                                                                                                                                                           | Dependencies                                         | Effect of deferral                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| V — verification foundation         | Restore required test policy, preserve historical waiver fixtures, run bounded phase suites and bind results to source/runtime. Require zero unexplained failures.            | None                                                 | Unexecuted regressions keep concealing faults; build success cannot replace behavioral checks.           |
| L — local play and creator recovery | Verify explicit briefing/Start, Retry, restored Team attempts, native Snake previews and suspended Studio storage. Retire in-flight launches when ownership changes.          | V; current shared shell                              | Back or asynchronous installation can revive stale missions or unusable storage.                         |
| R — recordings                      | Test genuine archived Team/Versus files, malformed ownership, ordered releases, copy fallback and historical v1. Report raw-state and terminal-outcome results independently. | V; current native engines                            | A downloadable file may still be unverifiable; outcome evidence might be mistaken for restorable state.  |
| A — artwork and Studio resources    | Verify animation/atlas round-trips, budgets, cancel/reopen, co-owners, late decode disposal, fallback and atomic adoption refusal/recovery.                                   | V; existing asset schema                             | Repeated previews or two boards can retain memory or block navigation despite a nominal budget.          |
| N — private rooms                   | Complete software liveness/expiry, snapshot ownership, readiness, input and event deduplication regressions; exercise the real local HTTP service.                            | V; native engines; shared presentation               | Stale seats or inputs can resume play after reconnect; duplicate effects obscure authoritative outcomes. |
| P — pilot play                      | Demonstrate completion and intended interception in six pilots, preserving exact recipe, mode, pace, seed and original recording provenance. Include supported slower play.   | Correct L/R/N as applicable                          | Geometry admission alone does not prove catchability, useful Team roles or enjoyment.                    |
| C — production art                  | After explicit Phase C review, extend the accepted treatment through families, machinery, Team equipment and supported SIM models in small appearance packages.               | User art/sound decision; A                           | Current candidate remains available for review; no approved full-roster visual upgrade is claimed.       |
| Q — device and public qualification | Actual phones/controllers, low-end memory/frame-time, offline/restore, EN/UK, muted/reduced effects; real-network private rooms with configured HTTPS.                        | Accepted feature head; appropriate hardware/endpoint | Source may be ready for review but not qualified for public recommendation or hosted play.               |

## Phase exit rules

Each feature needs: a concrete behavior, native adapter/Studio ownership, backward compatibility, executed regression evidence, relevant manual observations, and an explicit status for device/human acceptance. A failing or missing check remains open; it is never silently converted into a waiver. Use small regression slices while fixing defects, then run the combined feature suite once the shared head stabilizes.

Every PR includes its parent, changed behavior, exact commands/counts, known failures, source identity and build evidence. A later passing test only replaces an earlier failed result for the same tested contract and identified source. Test evidence does not authorize main integration, production asset promotion, or public deployment.

The six pilot cases remain separate: Crossing Post Solo/Versus; Pincer Yard Team; Relay Rendezvous Team; Cable Cutoff Snake Solo/Versus/Team; Shield Window Snake Solo/Versus/Team; Low Pass Depot native SIM. Existing clears are retained with their exact generations. The new pursuit generation needs its own behavior evidence. Historical v1 files stay strict and old recordings cannot unlock current progression.

## Continuous execution and stopping conditions

Continue independent streams while tests or builds run; queue the next feature once its prerequisites pass. Stop only dependent work for a concrete missing decision, physical device, endpoint or repeated external failure. Keep the rest advancing. Report implemented, automatically tested, manually observed, artistically approved and publicly delivered as different statuses.

The current corrected overhead treatment awaits an explicit production decision. Real hardware, human enjoyment and hosted HTTPS cannot be replaced by software fixtures. These are acceptance dependencies, not reasons to postpone independent code or tests.

## Optional scope retained

Broader catalogue promotion, media-bearing Community rooms, Company Versus editions, media registry delivery, hosted accounts, public matchmaking, challenges/ghosts, networked SIM and new destructible-terrain/vehicle-combat rules remain optional. They enter their own reviewed plans after required local quality and recovery work; visual inspiration does not imply new collision or combat rules.

## Repeatable phase verification

`npm run test:industrial` executes the six bounded streams declared in `publishing/industrial-feature-tests.json`: gameplay, creator, presentation, recordings, rooms and local UX. Use `npm run test:industrial -- --phase creator` to isolate one stream. Node 22.22.2 is the pinned CI runtime; additional runtimes need their own receipts.

Commit the stack before this command. It checks raw Git source identity before and after execution, records the Node/platform/architecture and test-file hashes, and refuses to call skipped, canceled, missing or failed tests a pass. Each invocation writes a unique directory under `.cache/industrial-verification/` with a run status, per-phase TAP logs, hashes and receipts. Incomplete runs cannot overwrite prior evidence. Phase execution has a ten-minute deadline; the GitHub matrix runs three independent phases at a time and retains artifacts for the exact PR head.

The restored required policy also exercises the pre-existing package and candidate workflows. Repairs distinguish runtime defects from obsolete fixtures: native Team release ordering, Studio storage retirement and flight cleanup are production fixes; actor-role fixtures, legal in-bounds projectile geometry, sequential historical pair sampling and approved optional-package inventory counts are verification maintenance. Neither category weakens the historical recipe, replay or package-budget contract.

This software matrix complements mandatory lint/format/content/source/build checks. It does not establish physical-device performance, human completion of the six Living Routes pilots, artistic approval or hosted-room readiness. The older pursuit-pressure route regressions are not substitutes for those six pilot routes.

## Executed follow-through

The first tested stack adds room wall-clock expiry, historical Snake seed recovery, prompt decode cancellation with retained memory accounting, suspended Studio storage recovery, Team input-release ordering, shared preview resource ownership and flight menu teardown fixes. Draft PRs #1024 through #1036 separate these changes and their verification foundation. Commit `e641e787de481ac6f5503a758dea2201fb6ff940` passed 532 source-bound feature tests, all six GitHub feature jobs, lint/format/content checks, a committed-source main build and two reproducible optional-package builds.

Restoring the broader suites also exposed obsolete integration expectations. The next layer (#1037) follows explicit briefing/Start, separate Demo ownership and earned-picture/Results navigation, and models the actual Canvas/Text boundaries used by the shared guide. It awaits real preparation promises instead of increasing generic timeouts. These test repairs preserve gameplay assertions; broader Company and appearance results remain separate from the six-phase receipt.

The [generated pilot route batch](qualification/pursuit-pilots/generated-routes-2026-10-04.md) adds exact native completion witnesses to the gameplay phase. Its fixed inputs and exported-session verification establish specific legal routes without altering authored missions. Human interception review, artistic approval, physical devices and real-network qualification remain required before promotion. Full roster artwork production continues to depend on the requested Phase C visual decision.
