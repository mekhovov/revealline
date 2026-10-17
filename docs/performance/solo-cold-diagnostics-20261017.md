# Cold comparison diagnostics retained 17 October 2026

Run [38991754594](https://github.com/mekhovov/revealline/actions/runs/38991754594) completed on tooling `aeadf7f43a8c1aba3af78d6cc8713666b4af49f1`. Candidate package/source remains `3adcd53792043ef02459e86168c6b33a66d6ef00` (runtime `0d9fef1120face4c0f9998ebd24a94e6df0d85c0`), baseline `b11745223861c3973ad4bf440cc536198b8e0371`. This is a diagnostic cohort with the historical first-eight prerequisite still false and overall performance **not qualified**.

All six source/archive setups passed. Ten of twelve declared observations ran; Chromium repetition 2 rejected fresh CPU calibration before both source rows. Its target was 1000, verification samples 1236/1176/1175 at rate 3.47, median 1176 and spread 5.19%. The 17.6% target error remained a rejection. No fallback or repeat replaced it. All ten observation command owners closed without forced cleanup, ambiguous processes or survivors.

The other Chromium repetitions used independently verified rates 2.46 (r1, median 978) and 2.27 (r3, median 1086.5). Chromium was 151.0.7922.34, ephemeral 1280×800/DPR1; WebKit was 26.5, persistent 400×850/DPR3/mobile context. These are hosted Linux browser strata, not Steam Deck or iPhone measurements. Both builds used the same frozen public First Return route and thirty alternating border controls. The raw gate targets and all failures remain unchanged.

| Observation           | Work samples | Work p95 ms | Maximum work ms | Missed opportunities | Maximum prior-running interval ms | Native recipe | Raw gates       |
| --------------------- | -----------: | ----------: | --------------: | -------------------: | --------------------------------: | ------------- | --------------- |
| chromium-r1-baseline  |          833 |        27.0 |          1105.5 |               78.66% |                           18965.9 | pass          | fail            |
| chromium-r1-candidate |         1799 |        14.1 |            36.3 |                2.76% |                              50.0 | pass          | fail            |
| chromium-r3-baseline  |          913 |        25.0 |           926.2 |               75.52% |                           17416.0 | pass          | fail            |
| chromium-r3-candidate |         1818 |        12.7 |            39.1 |                1.25% |                              50.1 | pass          | fail            |
| webkit-r1-baseline    |          804 |        11.0 |           281.0 |           unobserved |                           76707.0 | pass          | review-required |
| webkit-r1-candidate   |          982 |         8.0 |            27.0 |               52.26% |                             275.0 | pass          | fail            |
| webkit-r2-baseline    |          813 |        11.0 |           236.0 |               91.29% |                           75189.0 | fail          | fail            |
| webkit-r2-candidate   |            2 |       234.0 |           234.0 |           unobserved |                             974.0 | unavailable   | fail            |
| webkit-r3-baseline    |         1050 |        11.0 |           201.0 |               86.97% |                           58261.0 | pass          | fail            |
| webkit-r3-candidate   |         1082 |         7.0 |            21.0 |               51.61% |                             226.0 | pass          | fail            |

Work quantiles are exact nearest-rank summaries of the retained independent PRE_STEP→POST_RENDER callback ring. Maximum prior-running intervals include transition boundaries; they cannot by themselves attribute a GPU, main-thread, browser scheduling or operating-system cause. The missing WebKit baseline r1 cadence B leaves missed-opportunity accounting unobserved; its stored zero is not treated as a pass. The WebKit r2 candidate's two callbacks are a failed partial observation, not a valid percentile sample.

Chromium candidate r1/r3 have lower work than their paired baselines, but p95 14.1/12.7 ms exceeds the 10 ms gate, and missed opportunities 2.76%/1.25% exceed 1%. Their native recipe checks pass and no internal interruption is recorded. Both have thirty application keyboard latency samples, but their 33.34–50 ms p95 histogram bin straddles the 33.4 ms limit, so latency remains inconclusive. This cohort does not provide three completed Chromium pairs.

WebKit candidate r1/r3 complete the native recipe with exact work p95 8/7 ms, while cadence and missed-opportunity checks fail. Candidate internal pre-play B is unavailable, so input latency is unobserved even where thirty samples exist. External pre-navigation B remains independently frozen; it never replaces the missing internal calibration. WebKit r2 baseline strict replay checkpoint **matches** and has twenty-nine meaningful direction changes; native recipe admission fails because moving ticks 3145 are below the declared 3300 minimum. This is not a checkpoint mismatch.

## Runtime attribution from existing low-overhead samples

Chromium candidate r1/r3 average whole callback work is 9.52/8.63 ms. Measured update averages 3.91/3.47 ms and painter drawing 1.58/1.41 ms, leaving approximately 4.03/3.75 ms outside those two spans. HUD averages 0.075/0.068 ms and simulation 0.317/0.262 ms are nested in update and must not be added again. Update p95 upper bound is 6 ms and painter p95 upper bound 4 ms; their quantiles cannot be summed into a total p95. Current data supports profiling update/controller work and scene/render submission overhead before guessing a particular function.

The ready and final Chromium quality snapshots both report reduced effects. Sparse boundary snapshots do not prove a continuous tier history. The policy requires two consecutive overloaded one-second windows, ten-second dwell, and application work/cadence evidence. A whole thirty-second p95 failure does not prove those downgrade conditions occurred; the policy must not be changed merely to turn this cohort green.

WebKit r2 candidate entered playing at application timestamp 19995 ms and paused at 20613 ms, retaining 618 ms of phase duration. Its interruption counter records one 273 ms interval. The associated sample has 234 ms total work, 232 ms update, 1 ms drawing, 15 ms nested HUD and zero simulation. The scene detects interruption before update, and diagnostics attribute current work to the preceding phase. Therefore the 232 ms can include pause handling (durable save and overlay), and must not be declared the cause of the preceding 273 ms delay. The recipe subsequently timed out clicking the hidden pause button; no automatic Resume was inserted, and failure cleanup confirms it was already paused. Partial public replay export was unavailable. Bootstrap/ready delays and all subsequent paused intervals remain retained.

## Next causal recording, separately reviewed

One proposed Chromium candidate row uses the exact 3ad package and unchanged cold fixture `aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5`, same public controls, and the existing `--cpu-profile` facility. Retained r1 rate 2.46 is a fixed diagnostic stress factor on the new host, **not** a newly calibrated device equivalent. The complete profiled run is excluded from timing qualification. The CDP profiler uses 1000 μs sampling, at most 240 seconds and 64 MiB; timeline trace/screenshot/heap budgets are zero. Original recipe/owned-command bounds remain 240/480 seconds; one candidate row, no automatic retry, and full source/archive/CSP/process ownership admission. Partial, missing, capped or failed recordings are retained and never promoted. [CDP Profiler](https://chromedevtools.github.io/devtools-protocol/tot/Profiler/) documents sampling as JavaScript CPU profiling; it does not establish GPU completion or physical input latency.

The corrected sustained successor remains separate from these cold observations. Initial soak [38991754600](https://github.com/mekhovov/revealline/actions/runs/38991754600) failed its two-minute full declaration checkout before matrix generation; no observation or artifact existed. Supplemental [38991754643](https://github.com/mekhovov/revealline/actions/runs/38991754643) instead failed declaration import because a runtime-only module required lz-string before dependencies were installed. Both failures are retained. The sparse declaration correction copies only the demonstrated Node module closure and leaves gameplay/calibration/watchdog deadlines untouched. No cold rerun was released by that correction.

## Retained evidence

Each of the six archives below passed API size/digest, complete ZIP extraction and every-member readback checks. The local root is `.cache/solo-followup/remote-independent-comparisons-aeadf7f43`; each `cold-*-terminal/retained` folder contains immutable producer/artifact metadata, archive, inventory and retention receipt. A separate provisional completed-job r2 read while the parent run was active remains separate from final-run retention. All original raw reports, command receipts, source/archive proofs, replay outcomes and calibration samples remain unchanged.

| Artifact cohort | Artifact ID | ZIP SHA256                                                         |
| --------------- | ----------: | ------------------------------------------------------------------ |
| chromium-r1     | 12085597903 | `0d8c0bdad8ddd7f4bd229c1716369e9f1df72c500fd7613e67962289a1b4e61a` |
| chromium-r2     | 12084614980 | `742d244250ea3a69b7027a563f21b93acab23a4a94bcbc196a1ec7ad0a2601f5` |
| chromium-r3     | 12085299113 | `ffaa36953d3307524915983913570e5957faec867fae74ebd2d7611c15a219a1` |
| webkit-r1       | 12085761629 | `572eb5381173ec18e6133925bd05e88516f9dddf4a192032910e8ef744c43cea` |
| webkit-r2       | 12086005550 | `3ada2431bd47eef12aa52191ad2cb41e59768b27244bfc21a9ab2ab3159edbca` |
| webkit-r3       | 12085324268 | `3d828301db97162b40e23ba692b6b55011aed5e97cb477b2f22772784bb34a21` |

Compact derived files `cold-gates-full.json` and `cold-application-stages.json` preserve per-row gates/stages without pooling. Physical iPhone 17 Pro Safari/Steam Deck OLED qualification, three completed equivalent Chromium timing pairs, warm timing, sustained results, broader mechanic scenarios and matched diagnostic overhead remain outstanding.
