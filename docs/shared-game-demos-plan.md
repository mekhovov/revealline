# Shared game demos — current delivery plan

Updated **19 October 2026, 05:54 CEST**. Ready milestones are published in [draft PR #1615](https://github.com/mekhovov/revealline/pull/1615). The plan remains incomplete; no merge or public deployment has occurred.

The common framework and **890-entry authored corpus are implemented**. [Local integration onto main `ab47230f`](qualification/shared-demos/main-integration-ab47230f-rebase.json) is complete at `5f90e978f`: all 36 feature commits retain their authors, full messages and order; the final delta is exactly the 19 incoming paths. All 14 checked native content, simulation and replay objects are unchanged. [Semantic review](qualification/shared-demos/semantic-review-ab472-5f90e978f.json) passes, and [all three official generated-file checks](qualification/shared-demos/main-integration-ab47230f-generated.json) pass without changing tracked files.

**All 196 focused assertions across five files pass** in [the new integration run](qualification/shared-demos/main-integration-ab472-5f90e978f.json), with unchanged HEAD, runtime and build inputs on Node 20.19.5. This local milestone is ready for publication, followed by the fresh four-stage build. The previous integration and input repair were published in `034999ecf` and `45aec58e1`; the new `ab47230f` integration has not yet been published.

The SIM focus/Space concern is **fixed**. Focused toolbar keys and controller gestures stay with UI; native entries share the existing controller navigator; neutral/fresh pickup and explicit radio handoff remain intact. [SIM ownership checks](qualification/shared-demos/sim-ui-ownership-034999ecf.json) pass 27/27 and [shared menu/host checks](qualification/shared-demos/demo-shared-menu-focused-034999ecf.json) pass 45/45. These 72 checks, lint/formatting and independent review are retained with exact file identities through the rebase. Fresh emitted-browser proof remains required.

The held [runtime declaration](qualification/shared-demos/source-freeze-latest.json) is **`892df93b69ae0d56e7ae631ef4a1dc268950db818e42b8be122109d0834e036c`**, 9,997 files / 404,434,188 bytes, on main `ab47230f`. [The previous input-repair declaration](qualification/shared-demos/source-freeze-45aec58e1-b81e5e8f.json) remains preserved. Hold the resulting candidate through build, browser and endurance work; assess later main changes by scope rather than invalidating runtime evidence for documentation-only changes.

## Agreed scope and decisions

One DRY framework covers Solo, Snake Solo, SIM and FPV Survival at every authored standard setup, including all allowed SIM flight modes. Complete genuine performances, current-mode entry after 60 eligible idle seconds, balanced random **Watch all modes**, isolated practice and unchanged player persistence/preferences remain required.

Team/Versus, Raid, prototypes, free flight, editors, custom combinations and new personal-recording collection outside Solo are excluded. Existing Solo recordings, bots, improvisation, artwork access and settings stay compatible. Standalone SIM keeps its existing size limit and ordinary flight; shared demo actions are hidden where the shared corpus is absent. Demo entry never installs missing packages.

The user confirmed ordinary Solo eligibility: installed locked missions use isolated tick-0 practice, uninstalled exact missions open the normal chooser, and eligible installed missions reach Ready through the departure guard. Watching and takeover cover all authored missions. Normal SIM launch remains disarmed. Human/device review was not waived; reviewer timing is unknown and automated work continues independently.

## Completed implementation

| Area | Delivered behavior |
| --- | --- |
| Shared framework | Common adapter registry, director, host, toolbar/styles, scheduler, captions/history, input ownership, settings, idle detection, audio intent, fullscreen and asynchronous disposal. Each adapter uses its real simulation, renderer, timestep and replay format. |
| Rotation and guidance | Shuffled mode bag, then unvisited level/variant bag, then recording choice; duplicate clips do not increase a level's weight. Approachable first run, complete outcomes, immediate Next and one payload prefetch. Goal/source labels, actual-event captions, six-second display, last-five history, localization, reduced motion and current bindings. |
| Practice and persistence | Displayed checkpoints reconstruct into isolated practice; fresh initiating input applies once. Held-input/drift guards, focus ownership and guarded normal departure preserve scores, rewards, saves, recovery and tuning. |
| Recovery and resources | Fifteen-second source deadline, thirty-second total budget, bad-source skipping, unavailable-mode suspension, verified fallback preference after timeouts, late-result retirement and bounded cleanup. One active scene and one simulation driver. |
| Native corpus | **890/890 entries** reach genuine terminal outcomes with meaningful progress: Solo 240, Snake 240, SIM 392 and Survival 18. Solo uses 242 clips for 240 entries. Complete native replay receipts exist in Chromium, Firefox and WebKit; native identities survive this integration. |
| Replay diagnostics | Five-second checkpoints supplement full verification. Representative four-mode first-divergent-tick diagnostics, injected faults and cancellation pass in all three engines; this is not all-890 per-tick tracing. |
| Publication and offline selection | Every Classic mission enumerates from lightweight metadata. Exact artwork fallbacks and finite demo dependencies are retained; only redundant source originals are omitted from main-pages. Full releases preserve originals. Existing package limits remain unchanged. |

## Remaining work in priority order

| Priority | Item and current status | Completion condition / conditional estimate |
| --- | --- | --- |
| P0 — ready to publish | Tested integration milestone | All 196 assertions across five files pass with exact source bindings. Publish the rebased evidence, then hold the resulting candidate for build and browser qualification. Allow 5–10 minutes for publication. |
| P0 — next | Fresh four-stage build | Main-pages/emitted capture, full packaging, repository validation and lint must pass on the new held source. Use fresh evidence paths and both 200 MiB storage floors. Allow 15–25 minutes after publication if checks pass. |
| P0 — unresolved strict gate | WebKit restoration diagnostic | The prior run passes 12 functional checks but retains a native Fetch access-control pageerror. [The reviewed observer](qualification/shared-demos/webkit-owner-observer-preparation-c9101428.json) passes **12 preparation checks only**. Run it against the new emitted candidate and resolve or explicitly adjudicate the strict requirement. No filtering or relabeling historical failures; resolution ETA unknown. |
| P0 — external execution | Current-head hosted CI | Assess the newly published head and require successful checks. Previous queued/absent results and conflict snapshots are historical, not current success. Scheduler/completion ETA unknown. |
| P1 — awaiting build | Three-browser and native-menu checks | Run the sequential Chromium/Firefox/WebKit matrix for restoration, mixed practice, SIM Fresh, graphics recovery and listener cleanup, plus the focused **14-check native-menu browser probe**. Require exact source binding and complete owned cleanup. Allow 20–40 minutes for the matrix and 5–10 minutes for the menu probe, conditional on success. |
| P1 — fixture ready | Actual game discard | The corrected fixture seeds its declared credential before the first game document and preserves Chrome's native eligibility. Its eight preparation checks are not a game-discard pass. Run against the new emitted candidate; allow 5–15 minutes, plus diagnosis if needed. |
| P1 — awaiting short checks | Uninterrupted two-hour rotation | Run a fresh complete 7,200-second interval with bounded failure/loading/resource observations. No earlier partial minutes count. Allow two hours plus 5–15 minutes for cleanup after watching begins. |
| P1 — reviewer availability unknown | Human and physical devices | Unfamiliar-player comprehension, physical controller/SIM radio, real phone/tablet and audible playback remain unperformed. Use the [manual procedure](qualification/shared-demos/manual-review.md); 1.5–3 hours hands-on when reviewers/devices are available, calendar ETA unknown. |
| P2 — ongoing | Evidence, plan and PR | Update status and publish each tested milestone. Retain all original failed/incomplete receipts. Allow 15–30 minutes for final evidence review after technical gates. Keep the PR draft while required gates remain. |

The next sequence is **publish the tested rebased evidence → fresh build → browser/menu/discard checks → two-hour rotation → final review**. Estimates assume each stage passes; WebKit diagnosis, hosted scheduling, storage changes and human availability prevent a reliable overall completion time.

## Retained evidence and its limits

| Source-bound evidence | Result and scope |
| --- | --- |
| Prior `2476d97a` integration | [589 incoming plus 40 demo assertions](qualification/shared-demos/main-integration-2476-c9101428-retry.json) pass across 19 files. The first run's missing pinned-dependency import failure remains failed; the exact dependency was restored locally without changing source or lockfiles. These counts are not added to overlapping later suites. |
| Prior `575c10a312` main-pages | [All required payloads/dependencies pass](qualification/shared-demos/main-pages-demo-final-c4c5fc3-575c10a31.json); modeled archive 965,877,760 bytes is 14,122,240 below the unchanged limit. [Full packaging stopped at the disk floor](qualification/shared-demos/build-stop-followup-575c10a31.json), and final receipt writing failed with ENOSPC. This establishes no full-packaging/validation/lint pass or new-base qualification. |
| Prior `693947ed1` full build | [All four stages pass](qualification/shared-demos/shared-demos-build-validation-dd337c8-693947ed1.json). Modeled archive 965,857,280 bytes; full packaging 6,068 files / 1,116,344,982 bytes; core 1,742 files / 75,663,999 bytes. Actual upload admission/deployment remains separate. |
| Prior `693947ed1` browsers | [Ten of eleven strict jobs pass](qualification/shared-demos/browser-refresh-final-emitted-dd337c8-693947ed1.json). WebKit's 12 functional passes do not clear its native diagnostic. [Controls/remapping passes 13 checks](qualification/shared-demos/controls-emitted-693947ed1-sequenced.json). |
| Prior installed offline probes | [Representative playback](qualification/shared-demos/offline-representative-emitted-693947ed1-disconnected.json) and [eleven full-core actual-worker/ordinary-page checks](qualification/shared-demos/offline-full-core-emitted-693947ed1-public-api.json) pass with owned servers disconnected, unchanged persistence and full cleanup. This is representative offline coverage, not all 890 performances or the downloads UI. |
| Prior endurance | [The `693947ed1` attempt](qualification/shared-demos/rotation-chromium-emitted-693947ed1-final-two-hour.json) failed after approximately 14½ minutes at Retry, following Survival verification deadlines and a Solo timeout. [Source and cleanup checks pass](qualification/shared-demos/endurance-source-emitted-693947ed1-final.json), but no endurance credit is granted. The fallback correction retains [95 passing checks](qualification/shared-demos/timeout-recovery-693947ed1.json). |

The [evidence index](qualification/shared-demos/README.md) preserves the detailed chronology, earlier integration/source declarations, generated-artwork proofs, failed probes and independent reviews. Historical receipts keep their exact source and scope; none becomes a pass after a later repair.

## Concerns and acceptance limits

- **Storage:** owned external scratch is mounted; guarded work can proceed. [A 1.804 GB abandoned Git temporary pack](qualification/shared-demos/preserved-git-garbage-c9101428-resume.json) was independently verified, preserved externally and removed. Its writer remains unknown; the full observed free-space increase is not attributed to that cleanup. Keep both 200 MiB floors, preserve backups outside the disposable image, and leave user files/real Git objects/unrelated worktrees untouched. Earlier disk-stop receipts remain failed.
- **Loading:** prior Survival verification deadlines recovered in short samples but remain a startup concern. Machine load was observed without established causation. The new endurance run must distinguish recovered source failures from starvation, total-budget violations or leaks.
- **Lifecycle:** Chromium proves actual freeze/resume and Solo BFCache within recorded scope. Firefox/WebKit did not admit BFCache. A small-page native-discard setup passed, but actual game discard remains unproven. Later clean WebKit samples would not explain or erase earlier diagnostics; the [no-game investigation](qualification/shared-demos/webkit-engine-navigation-693947ed1-review.json) did not meet its exact reproduction predicate.
- **Scope of proof:** complete native replays establish content determinism, not every renderer startup or every offline/browser interaction. Artwork checks cover exact bytes/decoding and representative visible images, not all-image visual review. Modeled archive capacity is not an uploaded artifact.
- **External gates:** hosted jobs are not passes until successful on the published candidate. Headless inputs and narrow layouts do not replace physical-controller, mobile, audible or unfamiliar-player review.

The plan completes only when required behaviors and gates pass, or the user explicitly changes scope. Human availability does not block independent automated work. Public deployment remains a separate step.

[Feature guide](shared-game-demos.md) · [Qualification evidence](qualification/shared-demos/README.md) · [Manual review](qualification/shared-demos/manual-review.md)
