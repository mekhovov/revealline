# Solo e025: three Chrome comparison cohorts

All 36 eligible candidate runs passed the declared mechanics and same-artifact/native replay checks. All 36 passed measured work/cadence thresholds; only 9 have enough keyboard observations for the full observed-window gate. The other 27 remain latency-inconclusive. This is scoped desktop evidence, not an unconditional performance or device guarantee.

Candidate `e0252ff8f6b7f5ac84721fd5994c74e8469fb271`; baseline `b11745223861c3973ad4bf440cc536198b8e0371`. Chrome 155.0.8059.80, CPU 1, 1280 × 800, DPR 1. Original frozen per-run cadence baselines were about 16.7 ms; none were recalculated from gameplay.

There are 72 original core attempts and 2 separately declared cold-opening replacements. The original cold pair remains excluded because owned archive retention overlapped it. All raw reports are preserved; no delay cause or impact size is inferred. The table uses the eligible replacement for cold p1 only.

| Scenario                  | Baseline work p95, p1/p2/p3 (ms) | Candidate work p95, p1/p2/p3 (ms) | Candidate input samples per run | Candidate observed-window status |
| ------------------------- | -------------------------------: | --------------------------------: | ------------------------------: | -------------------------------- |
| original-art-opening      |                  3.6 / 3.8 / 3.6 |                   2.2 / 1.9 / 2.2 |                       2 / 2 / 2 | inconclusive in 3 windows        |
| original-art-opening-warm |                  3.8 / 3.8 / 3.9 |                   2.3 / 2.6 / 2.6 |                       2 / 2 / 2 | inconclusive in 3 windows        |
| original-art-sentinel     |                  5.7 / 5.9 / 5.7 |                   2.1 / 3.1 / 2.1 |                    30 / 30 / 30 | pass in 3 observed windows       |
| long-rail                 |                  4.4 / 4.6 / 4.4 |                   2.5 / 2.9 / 2.6 |                       5 / 5 / 5 | inconclusive in 3 windows        |
| first-fracture            |                  4.3 / 4.5 / 4.5 |                   2.7 / 2.8 / 2.4 |                       1 / 1 / 1 | inconclusive in 3 windows        |
| sentry-detour †           |               12.8 / 12.6 / 12.8 |                   2.7 / 2.8 / 2.8 |                    11 / 11 / 11 | inconclusive in 3 windows        |
| signal-07                 |                  4.7 / 4.5 / 4.7 |                   2.7 / 2.3 / 2.5 |                       0 / 0 / 0 | inconclusive in 3 windows        |
| enabled-audio             |                  4.6 / 4.5 / 4.5 |                   2.5 / 2.3 / 2.3 |                       0 / 0 / 0 | inconclusive in 3 windows        |
| recorded-speech           |                  4.4 / 4.2 / 4.3 |                   2.7 / 2.5 / 2.3 |                       5 / 5 / 5 | inconclusive in 3 windows        |
| recorded-music            |                  3.7 / 3.6 / 3.6 |                   2.4 / 2.4 / 2.1 |                       0 / 0 / 0 | inconclusive in 3 windows        |
| large-profile             |                  3.4 / 3.3 / 3.4 |                   1.8 / 1.8 / 1.8 |                    60 / 60 / 60 | pass in 3 observed windows       |
| twenty-retries            |            (4,6] / (4,6] / (4,6] |             (2,4] / (1,2] / (2,4] |                    40 / 40 / 40 | pass in 3 observed windows       |

Each value is a separately observed run, with no pooling or causal speedup estimate. Twenty Retry uses lifetime histogram intervals because its ring does not retain every callback. The other values are exact per-run nearest-rank quantiles rounded for display. Same wall-time actions can yield different trajectories. Candidate tier snapshots were full when available (136 full, 8 unavailable); baseline tier is unavailable. Sparse snapshots do not establish equal quality throughout.

† All three baseline Sentry recordings match their own strict checkpoints and immutable level definitions, but show no required shot/projectile. These workloads failed and are not equivalent-mechanics comparisons. Baseline statuses overall are 24 failed numerical windows and 12 review-required windows; no baseline pass is invented.

One candidate missed opportunity remains visible: warm-opening p2 has a 33.4 ms active interval, streak 1, rate 0.3145%. Its original numeric gates pass. All other candidate active maxima are about 16.8 ms, with no safety interruptions or application/page errors. Baseline cold-opening active maxima are 2733.2 / 2699.9 / 2699.9 ms. Startup/preparation and other phase costs remain in the raw reports; interval location alone does not prove their cause.

Sentinel, large-profile and twenty-Retry meet the 20-observation per-run input minimum in all three runs. The nine short/neutral scenarios have 0–11 events per run. Their descriptive all-event values remain available, but three sparse runs are not pooled into a latency pass. Touch/controller/physical display latency is not measured here.

The Retry runs retain the same last-ten owner plateau in each: 8 painter canvases, 11,632,640 estimated RGBA bytes and 2 Phaser canvases. These counters exclude native/GPU allocation and do not close the heap/DOM memory gate. Node portability mismatches also remain explicit (candidate 18/36, baseline 12/36); same-artifact/same-browser strict verification supplies the native correctness result.

Separate scoped evidence is linked in the machine-readable report: four static-worker/paused-render checks; Chrome/WebKit synthetic recovery with public auxiliary readiness; Chrome actual hidden/visible plus both paused viewport recoveries; eleven-win/ten-Next functional pilot; 11 static raster cases; and excluded long-recording CPU profiling. Each keeps its own limits and source identity. WebKit actual background is unobserved. The long profile’s strict export covers 21,603 neutral ticks before victory; the 5,298-byte export contains one input segment; later win/Next actions passed, but that export does not cover them. Journey verifier samples ended before Next, so actual verifier overlap was not observed. Sample totals are not single-task durations.

Remaining qualification is separate: DPR3/WebKit and calibrated stress cohorts, matched ≤5% diagnostic overhead, six ten-Next timing observations, final-runtime 30-minute soak, heap/DOM memory, exact audio proof, and regression closure. Later source-scoped guarded remote observations now pass dense replay/save 3/3, pending verifier ownership across Next/Retry 2/2, and meaningful keyboard/gamepad cadence plus interruption/Resume 4/4. Their [regression receipts](solo-regression-summary.md) preserve exact source identities and prior failed or cancelled attempts; these are Node correctness checks, not additional e025 timing observations or native serialization/overlap measurements. Physical iPhone/Steam Deck and WebKit real background remain unobserved. Later runtime changes are not retroactively assigned these e025 results.

Machine-readable attempt/gate/source/hash ledger: [solo-qualification-e025.json](solo-qualification-e025.json). Original detailed analysis: `.cache/solo-followup/matrix-v10-analysis-core-three-cohorts-01.json` (`4f7663c54bd165941bb5e533ec0c153c6c887c3728ba197140387c6f6258c25a`). All prior drafts and raw attempts remain retained.
