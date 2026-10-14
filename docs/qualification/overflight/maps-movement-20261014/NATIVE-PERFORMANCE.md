# Native reference-fixture performance

**All three quieter repeats pass the unchanged local reference-fixture cadence criteria.** Their p95 intervals are **9.6 / 9.8 / 10.0 ms**, with **zero measured intervals above 33.3 ms**. The original three trials remain valid failures of the 18 ms p95 requirement, and the 15-minute soak also retains its p95 failure. No failed samples were trimmed, replaced or reclassified.

The original trials and soak tested `3bb1b0dc66ae77baf59d0e89ab9edf257a244d10`; the repeats loaded integration commit `3739ca96785095f5b5484f6321a8469370957c48`. The eight measured combat/render/host source files in the [compact summary](native-performance-summary.json) were verified unchanged between these commits. The summary includes both conditions, exact windows and verified raw-file SHA-256 digests. These are local native-browser measurements, not qualification of the previously specified Iris Xe laptop or M1 Safari.

## Conditions and workload

- Apple M4 Pro: 14 CPU cores, 20 GPU cores, 48 GB memory; macOS 26.7.1, build 25G241.
- Codex in-app Chromium 155; approximately 120 Hz display; AC power.
- Actual viewport: 936 × 1143 CSS pixels, device pixel ratio 2. The game backing surface remained **960 × 540**.
- Reference fixture: 1,500 simulated enemies, 700 visible and rendered, 480 pickups; seed `17031991`. Normal effects, authored Scout appearance, no recording during measurement.
- Each trial restarted separately, warmed up for 30 seconds, then measured a 120-second window. Audio context was running with master audio muted; these runs do not qualify the audible mix.
- During the original three trials and soak, a normal production build and other desktop graphics work were active. During the quieter repeats, production preparation had finished, and no agent simulation jobs or gameplay recording were active. Other user desktop apps remained open. Neither group represents an isolated machine. The contribution of these conditions was not instrumented, so no causal attribution is made.

Acceptance requires average cadence ≥59 FPS, p95 ≤18 ms, p99 ≤33.3 ms and fewer than 1% of intervals above 33.3 ms. The counters measure completed Phaser render callbacks; they do not provide GPU timestamps or physical display-presentation timestamps.

## Original trials — preserved failures

| Trial                                 | Capture UTC  | Measured seconds | Frames | Average FPS |   p95 ms | p99 ms | Above 33.3 ms | Result            |
| ------------------------------------- | ------------ | ---------------: | -----: | ----------: | -------: | -----: | ------------: | ----------------- |
| [1](native/reference-trial-1.json.gz) | 14:48:59.818 |         119.9887 | 11,542 |     96.1924 | **21.7** |   28.1 |  37 / 0.3206% | Valid; p95 failed |
| [2](native/reference-trial-2.json.gz) | 14:52:10.499 |         120.0000 | 11,530 |     96.0833 | **18.8** |   27.2 |  28 / 0.2428% | Valid; p95 failed |
| [3](native/reference-trial-3.json.gz) | 14:55:30.206 |         119.9975 | 10,121 |     84.3434 | **24.3** |   30.4 |  58 / 0.5731% | Valid; p95 failed |

All captures are from 2026-10-14. Each reports a complete measurement window, no invalidation reason, zero raw-sample overflow and zero dropped simulation time. Worst measured intervals were 71.4, 66.6 and 197.2 ms respectively; the last remains in the evidence despite p99 passing.

The workload retained all 700 visible actors. Atlas storage was 28,467,840 RGBA bytes: 16,026,240 for sprites and 12,441,600 for world tiles. This excludes decoded sources, retained preparation/recovery surfaces and other browser/GPU storage. There was no graphics-context loss in these trials. These counters do not replace the separate resource inventory or soak.

## Quieter repeats — all three pass

The same reference workload, seed, viewport, backing resolution, normal effects and muted master audio were used. Each repeat restarted separately with its own 30-second warm-up and 120-second measurement. An initial new warm-up was restarted before measurement to load the recorded integration commit; it was not a completed trial. The [repeat manifest](native-reference-repeats.json) records the exact conditions and source.

| Repeat                                 | Capture UTC  | Measured seconds | Frames | Average FPS |   p95 ms | p99 ms | Above 33.3 ms | Result          |
| -------------------------------------- | ------------ | ---------------: | -----: | ----------: | -------: | -----: | ------------: | --------------- |
| [1](native/reference-repeat-1.json.gz) | 15:25:20.818 |         120.0009 | 14,401 |    120.0074 |  **9.6** |   10.5 |    **0 / 0%** | Valid; all pass |
| [2](native/reference-repeat-2.json.gz) | 15:28:56.883 |         119.9991 | 14,400 |    120.0009 |  **9.8** |   10.6 |    **0 / 0%** | Valid; all pass |
| [3](native/reference-repeat-3.json.gz) | 15:32:22.098 |         119.9994 | 14,402 |    120.0173 | **10.0** |   10.7 |    **0 / 0%** | Valid; all pass |

All captures are from 2026-10-14. Their worst measured intervals were 12.9, 11.6 and 12.5 ms. All 700 visible actors were rendered, atlas storage stayed at 28,467,840 RGBA bytes, and all three report zero raw-sample overflow, dropped simulation time and graphics-context losses. Raw hashes and measured-window sample counts were checked against the compressed recordings; all three full measured windows are retained.

These repeats establish the local reference workload passing under the recorded quieter conditions. They do not identify why the earlier measurements failed, erase those failures, establish full-content performance or qualify the Iris Xe/M1 targets. No runtime performance optimization or relaxed threshold separates these result groups.

## What the original-trial timing data does and does not show

The CPU analysis uses only each measured window. Rendering submission is matched by its exact recorded end timestamp. Simulation batches are matched by tick to the first corresponding host frame; host and renderer arrays have equal lengths and cadence correlations of 0.959–0.973. Frames without a simulation step contribute zero simulation time.

| Trial | Submission p95 ms | Simulation per rendered frame p95 ms | Combined measured CPU p95 ms | Combined maximum ms | Cadence/submission correlation | Cadence/simulation-per-step correlation |
| ----- | ----------------: | -----------------------------------: | ---------------------------: | ------------------: | -----------------------------: | --------------------------------------: |
| 1     |               2.5 |                                  1.8 |                          3.8 |                 6.5 |                         −0.082 |                                   0.019 |
| 2     |               2.9 |                                  2.2 |                          4.4 |                 7.8 |                         −0.119 |                                   0.063 |
| 3     |               2.8 |                                  2.4 |                          4.6 |                 8.2 |                         −0.023 |                                   0.056 |

No interval above 18 ms had more than 18 ms of combined measured simulation/submission CPU work. Longer intervals correlate with larger simulation batches, but that relationship nearly disappears when time is normalized by the number of catch-up steps. This is consistent with longer gaps requiring catch-up, rather than a large increase in the cost of an individual simulation step. For example, trial 1's worst 71.4 ms interval contains 2.9 ms of simulation and 1.1 ms of submission work.

The measured CPU spans therefore do not explain the full cadence gaps. They exclude some host UI/audio work and cannot distinguish scheduling, garbage collection, compositor/GPU work or other unmeasured activity. Low measured CPU time is not proof of spare GPU capacity or proof that the background build caused the failure. No runtime optimization or acceptance waiver follows from these observations.

## Remaining qualification

1. Complete actual full-content Survivor, Riy and Raid workloads. The reference fixture is controlled capacity evidence, not gameplay pacing or full-content acceptance.
2. Assess evidence applicability after the next candidate’s cosmetic changes. These measurements describe their recorded source; they are not silently relabelled as measurements of a later revision.

## Additional completed workloads

The [15-minute soak](SOAK.md) completed its lifecycle observation on the same `3bb` source. One canvas, fixed pools and atlas ownership remained stable; the sprite pool plateaued. Its measured p95 was **22.6 ms**, so lifecycle completion is not a timing pass. The complete raw sample set is retained.

One separate [stress trial](native/stress-trial-1.json.gz), captured at `2026-10-14T15:15:44.251Z`, ran 2,500 simulated / 1,200 visible actors after a fresh 30-second warm-up. All 1,200 visible actors were rendered. Its complete 119.993-second window passed: **99.614 FPS**, **17.0 ms p95**, **25.5 ms p99**, and **0.1673%** of intervals above 33.3 ms. Worst interval was 47.4 ms. The run was valid, with no exclusions; raw SHA-256 is `8b8e302d6a9f001f5b754684675488ab1100aa0ddcb1800a6330e54651628d53`. This is one stress observation, not a replacement for the three reference trials or proof that desktop load caused their failures.

See [measurement boundaries](PERFORMANCE-INSTRUMENTATION.md) before drawing conclusions from the low recorded simulation/submission CPU spans.

External-device and five-player trials remain **skipped, not passed**, as previously waived. This report makes no enjoyment or audible-quality claim.
