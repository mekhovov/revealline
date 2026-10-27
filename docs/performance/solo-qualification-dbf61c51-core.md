# Solo qualification — dbf61c51 core cohort

The first core stage completed all 36 declared baseline/candidate observations on 16 October 2026. Three stressed Chromium candidate jammer-level movement observations pass the complete measured-window gates. The stage does **not** qualify the whole plan: opening results exceed the missed-opportunity gate, WebKit retains measurement limitations, and all three candidate Long Rail observations contain page errors. Every failed attempt remains retained.

The candidate is the independently verified [`dbf61c51` package](solo-artifact-dbf61c51.md); baseline is original main `b11745223861c3973ad4bf440cc536198b8e0371`. Tooling is `085e738d467e7006e111d76b9dd48fb0119ceb68`. Chrome is 155.0.8059.85; desktop WebKit is 26.5 with fresh persistent contexts for both versions. These engines do not establish iPhone Safari 27.0.1 behavior.

Fresh calibrated Chromium stress selected **3.75×** against the predeclared score target of 1,000. Independent scores were 1,025, 1,024.5 and 1,041. This is CPU stress, not a mobile GPU or thermal simulation. Baseline cadence was fixed before game navigation; no loaded-gameplay recalibration or sample trimming was used.

## Candidate observations

Each row contains three independent observations. Work values below are the independent exact callback measurements, not summed nested stages.

| Browser / scenario                       | Callback work p95 | Maximum callback work | Missed opportunities | Outcome                                                                                                                |
| ---------------------------------------- | ----------------- | --------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| WebKit, cold short opening capture       | 3 ms              | 64–68 ms              | 1.246–1.553%         | Mechanics/replay pass; missed-opportunity gate fails.                                                                  |
| WebKit, warm short opening capture       | 2–3 ms            | 66–69 ms              | 1.246–1.858%         | Mechanics/replay pass; missed-opportunity gate fails.                                                                  |
| WebKit, Sentinel jammer movement         | 2 ms              | 4–5 ms                | 0.275–0.384%         | Mechanics/replay and external budgets pass; internal baseline unavailable and Pause-crossing intervals require review. |
| WebKit, Long Rail                        | 3–4 ms            | 14–18 ms              | 0.242%               | Mechanics/replay pass, but 6/7/7 page errors fail the scenarios.                                                       |
| Chromium 3.75×, short opening capture    | 5.8–6.2 ms        | 42.9–46.5 ms          | 1.242–1.548%         | Mechanics/replay pass; missed-opportunity gate fails.                                                                  |
| Chromium 3.75×, Sentinel jammer movement | 5.3–5.4 ms        | 13.5–14.6 ms          | 0–0.055%             | All complete measured-window gates pass, including application input latency.                                          |

No candidate observed application callback reaches 100 ms and no candidate overload pause is recorded in this cohort. This does not exclude unobserved work outside those callbacks. The complete stage has 31 scenario passes and five scenario failures; numerical summaries are 24 failed, nine review-required and three passed measured windows.

## Findings and follow-up

The short opening routes contain approximately five seconds of active play and only two meaningful keyboard samples. Their victory frames retain 25–31 ms of synchronous terminal work; WebKit also records a nested HUD cost around 32 ms. The following retained frame interval spans accepted victory and entry into the picture/result phase. The explicit result-overlay witness occurs about 5.4 seconds later; it is not inside this interval. These nested values must not be added together, and transition-crossing samples remain in the original gates. Separately versioned first-30-second cold/warm routes will supplement these captures with at least 20 replay-proven movement direction changes. The original short results are not replaced or relabeled.

WebKit Sentinel's retained 100/100/103 ms intervals cross explicit Pause markers. They remain conservative prior-playing review evidence, not demonstrated active-play stalls. The baseline opening intervals include multi-second gaps overlapping public input dispatch; the independent application callbacks do not account for those gaps. Their cause remains unattributed. Two stressed Chromium baseline Sentinel observations fail minimum required movement and cannot be averaged as equivalent workload comparisons.

Long Rail's six bootstrap fetch errors occur while the top-level page is still Playground, during the auxiliary preparation wait and **before** the later top-level navigation. A separate bounded native frame/request diagnostic completed the unchanged route and strict replay without reproducing the page errors. It observed an early Playground child-frame replacement and successful bootstrap requests in that attempt. The original three failed observations remain unexplained; neither top-level departure nor a production correction is established. The diagnostic is excluded from timing qualification.

The remaining soak, ten-Next, audio, memory, recovery and diagnostics-overhead stages have not run on this package. They are held while the separately reproduced Demo media-admission defect is corrected and a successor package is verified. Physical iPhone regular-tab/PWA and Steam Deck qualification remains unavailable.

## Evidence

- Stage receipt: RAM `evidence/qualification-v15/01-core/orchestration/receipt.json`, SHA-256 `a0686602d2a35fc9c532fee8304bbd2c11e42ea5428352cfab920915d87bb708`. Closed 16:54:11.030 UTC, all 36 attempted, clean browser/process closure without forced cleanup.
- Matrix SHA-256: `d04f0b6cb2f8a712cf83905b5913dd321985ae65a5c096f858b44aa78e0b4019`.
- Calibration report SHA-256: `215e517251ab07e557a59dbec48802dccf6462d11fa49ac08319b82fd7c158ac`.
- Read-only derived analysis: `.cache/solo-followup/qualification-v15-stage01-analysis/analysis.json`, SHA-256 `cf6d53c9cdf09710732563b0cf529b66a59afbf9a0394b61323c6932cd3e8752`. No derived analysis changes the original reports or gates.

The complete core stage, calibration, derived analyses, Long Rail diagnostic and twenty executed helpers were preserved together and read back without modifying the sources: 175 members, archive SHA-256 `d0ca2e6fff781137bce5509b1c15e320968462d556f064dd4d547174eb40a99f`, under `/Volumes/alex/solo-performance-b1174522/evidence/stage01-final-dbf61c51-preserved-01/`.
