# Retained Next, Retry and sustained native outcomes

These are observations of candidate `a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4`, tree `6b13627e324f695b6ee8d9f2dee2eeeb7217c332`, against the normal `8b01991942dc764b8aa4726851699ce1985e53ae` baseline. The tools were dispatched at `c41a02216c0811952232a387fd1743e09452c269`. They do not qualify the later readiness/runtime changes packaged from `ab45bfde5d54d612cbba9b038a46f13d13f417ec`. Raw failures, missing fields and partial recordings remain retained. All observations remain excluded from overall performance qualification.

## Completed transition cohorts

[Ten Next transitions](https://github.com/mekhovov/revealline/actions/runs/39015298598) declared 12 arms. Ten ran; the Chromium repetition 2 pair did not run because its external calibration failed. Only candidate WebKit repetition 1 completed all ten public transitions and the required final mission. Its numeric gate still failed. The other nine observed arms stopped on an earlier mission. Their exported recordings match source-native replay state, but fail the required final `second-landing` mission check. This is missing workload completion, not a demonstrated replay determinism mismatch.

[Twenty retries](https://github.com/mekhovov/revealline/actions/runs/39015298498) ran all 12 arms. Five candidate rows passed their scoped public-control/replay/resource protocol: all three Chromium repetitions and WebKit repetitions 1 and 3. This is not a timing pass: the Chromium arms explicitly exclude timing because of memory profiling, and the WebKit numeric gates fail. Candidate WebKit repetition 2 auto-paused and failed its first expected result. Baseline arms remain non-passing, including unobservable owner counters.

All 22 observed Next/Retry recordings match source-native replay state. The strict workload checks and raw numeric failures remain independent. The two blank WebKit page-error strings were witnessed on the playground navigation, before the long gameplay action: candidate Retry repetition 2 at `08:05:51.664Z` and baseline Retry repetition 3 at `08:13:50.468Z`. The latter completed the public 20-retry workload and native replay but still retains its page error. The former also has a separate active-play interruption/result timeout; the navigation error is not proof of that interruption's cause.

The retained compact classification is `.cache/solo-followup/final-wave-v2/timing-results/next-retry-terminal-summary-v2.json`, 156,193 bytes, SHA-256 `d4dbb7da2b8178a427fa60134429fa67da6a85782f124195e61ab8dfcd38ccf6`.

## Sustained observations retained so far

At the `09:12:57Z` status readback, [the 30-minute cohort](https://github.com/mekhovov/revealline/actions/runs/39015298699) had completed four of its six source pairs. Chromium repetition 3 and WebKit repetition 3 were still running. The anchored route captures 34.29%; it is distinct from the older 51.43% route. Thirty minutes describes the whole fixed public retry session, including preparation/results; the active-play intervals below are reported separately.

| Completed candidate arm | Completed cycles | Foreground running frames | Running-to-running intervals ≥100 ms | Outcome                                                                                     |
| ----------------------- | ---------------: | ------------------------: | -----------------------------------: | ------------------------------------------------------------------------------------------- |
| Chromium repetition 1   |              165 |                    58,313 |                                    0 | Public workload and strict native replay pass; numeric gate fails                           |
| Chromium repetition 2   |              170 |                    58,111 |                                    0 | Public workload and strict native replay pass; numeric gate fails                           |
| WebKit repetition 1     |              146 |                    46,139 |                           1 (150 ms) | Required workload/replay complete; blank navigation page error retained; numeric gate fails |
| WebKit repetition 2     |                0 |                   Partial |    A 383 ms active interval retained | First expected result timed out; no automatic resume/retry                                  |

The two Chromium candidates recorded approximately 978.694 and 1,011.376 seconds of foreground active intervals. Their zero counts above apply only to fully foreground running-to-running callbacks; they do not erase boundary hitches, preparation interruptions, shorter missed frames, numeric failures or unobserved physical-device behavior. Their baseline controls completed 130 cycles each with 210 and 227 active intervals ≥100 ms. All four Chromium arms completed public workloads and strict native replay with matching state, and all four numeric gates failed.

For both Chromium candidates, all 118 owner-counter series are flat at the ten declared completed boundaries, and pending owners are observed idle. All observed owner budgets have zero violations. The overall bounds assessment remains **inconclusive**: 20 counters are absent only in the initial pre-activation snapshot (the published PCM owner and soundtrack admission/inspection/playback owner). The 167/172 later report snapshot totals are retained in full. Missing pre-activation owners are not silently converted to zero. Baseline owner assessment remains inconclusive with 15,312 missing-field observations per arm. Flat sampled counters do not establish browser/GPU memory stability or a universal retention pass.

Candidate WebKit repetition 1 has 149 snapshots including the failure capture, 146 completed cycles, matching strict native replay, and 118 flat series at the ten declared completed boundaries. Its four missing published-PCM fields occur only in the initial pre-activation snapshot. The retained blank page-error witness is at `08:30:42.831Z` on playground navigation before gameplay, not evidence of an in-play exception. Candidate WebKit repetition 2 fails early; its baseline completed the full session with 142 snapshots, matching replay and a failed numeric gate. The later WebKit owner observations do not turn either arm into a performance pass.

All four completed sustained jobs have clean command ownership: no forced cleanup, surviving owned processes or ambiguous ownership. Their snapshot chunks and complete binary journals passed exact byte/hash readback. Relevant compact receipts:

- Chromium repetitions 1/2: `.cache/solo-followup/final-wave-v2/timing-results/soak-chromium-r1-r2-review.json`, 309,207 bytes, SHA-256 `6edd99432c1e6f086a2b36e9e0ef9611b2cb250bba11c0194d567481854c044a`. Original artifacts `12095548591` and `12096162951`, 8,034,649 and 8,217,519 compressed bytes; unpacked members 63,228,429 and 64,563,632 bytes.
- WebKit repetition 1: `.cache/solo-followup/final-wave-v2/timing-results/soak-webkit-r1-review-v2.json`, 57,357 bytes, SHA-256 `96606f5006659dbde8486209c8c5f21e0136fc33b4fb9308785822b590f6fb81`; original artifact `12096296524`.
- WebKit repetition 2: original artifact `12095920030`; complete raw reports/chunks/journals are retained under the same run directory.

## Terminal sustained update

The `09:23:20Z` status readback confirms all six sustained pairs finished, all with failed workflow conclusions. The final artifacts passed the same full CRC/hash/member readback and source/owner checks; no rerun occurred.

Chromium repetition 3 candidate completed 151 cycles, 153 snapshots and 53,569 foreground active frames (approximately 896.664 seconds), with **zero** running-to-running intervals ≥100 ms. Public workload and strict native replay pass with matching state; raw numerical gates still fail. All 118 series are flat at the ten declared completed boundaries and pending owners are idle. Bounds remain inconclusive with the same 20 counters absent only in the initial pre-activation snapshot, and zero violations. Its baseline completed 135 cycles with 219 active intervals ≥100 ms and a failed numeric gate. Consequently, all three declared Chromium candidate repetitions have zero severe active callback intervals under this precise definition; this does not promote any numerical gate.

WebKit repetition 3 candidate completed 149 cycles, 152 snapshots and 52,735 active frames, retaining one active interval ≥100 ms. All explicit owner bounds pass across its 152 snapshots with zero missing counters or violations; all 118 boundary series are flat and pending owners idle. Strict native replay passes and matches, but numeric gates and the scenario still fail because a blank page error is retained. Its baseline completed 145 cycles and matching replay, with the same separate page-error failure. Both witnesses occur on action 4 playground navigation before gameplay: baseline `08:19:32.724Z`, candidate `08:50:19.174Z`. They do not establish an in-play error cause or justify removing either failure.

The same-pair Chromium component gates show a scoped improvement despite the overall failures. All three candidate cadence p95 bins are `(16.67, 20] ms` and pass their fixed external-B gate. Application work remains the common failing component:

| Pair         | Declared CPU stress | Baseline work p95 bin | Candidate work p95 bin | Baseline missed opportunities | Candidate missed opportunities |
| ------------ | ------------------: | --------------------- | ---------------------- | ----------------------------: | -----------------------------: |
| Repetition 1 |                4.00 | `(33.34, 50] ms`      | `(10, 12] ms`          |                       60.278% |                         0.861% |
| Repetition 2 |                2.42 | `(33.34, 50] ms`      | `(12, 16.67] ms`       |                       61.866% |                         4.428% |
| Repetition 3 |                2.28 | `(25, 33.34] ms`      | `(12, 16.67] ms`       |                       47.975% |                         0.509% |

These are bounded histogram intervals, not point estimates, and the differently stressed pairs must not be pooled. Candidate repetitions 1 and 3 pass the separate latency, missed-opportunity and cadence p99 checks. Repetition 2 fails missed opportunities; its latency and p99 remain inconclusive. The original work gate and every complete-row failure remain unchanged. The independent archive-based component receipt is `.cache/solo-followup/final-wave-v2/timing-results/soak-chromium-component-gates-root.json`, 18,026 bytes, SHA-256 `ba4aef1b27efd3594bb3f955a78e2103cd1a71fc1fc0d6dc5bd50146e0617fe8`.

Both final jobs closed cleanly with no forced cleanup, survivors or ambiguous ownership. The full journals and snapshot chunks were read back. The compact receipt is `.cache/solo-followup/final-wave-v2/timing-results/soak-r3-review.json`, 507,155 bytes, SHA-256 `ec349f7062937e4349d67e15dbb50960ef6e546bc0f6c79869eb503b97d5322e`. Artifacts `12096611719` and `12096473063` retain 60,397,830 and 33,284,954 bytes of members respectively.

To preserve local space, the already-reviewed Chromium repetition 1/2 extracted duplicates were losslessly compacted after every ZIP member was CRC/SHA checked against its exact local copy. Their original ZIPs, full inventories, readback receipts and compact analyses remain; each retained artifact directory has a `compaction.json` proof. Raw bytes are recoverable from these archives without downloading again. No raw evidence was discarded.

## Remaining terminal evidence

[The long-recording cohort](https://github.com/mekhovov/revealline/actions/runs/39015298744) still had five pairs running at the same status readback. Its Chromium repetition 2 pair did not run because external mid-tier calibration failed. That failure is retained; it is not a gameplay observation. The remaining long-recording pairs require terminal retention before that cohort can be summarized; the sustained cohort is now terminal as recorded above. No automatic rerun is declared. Future updates to this note must retain these exact historical sources and distinguish the newer runtime's separate package and observations.
