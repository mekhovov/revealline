# Earned late-content native timing

## Fixed protocol

Candidate runtime: `08f5e6e0ee93ae13955321c6a187e5f1148eef84`, served from the unchanged source checkout on port 8911. The downloaded payload does not embed a Git hash; the source revision is recorded by the operator and the importer. Documentation-only edits during trials do not change the served runtime.

Three separately restarted Riy sorties use Receiver Gardens, seed `202604`, Veteran, three airframes, Scout with handling traits disabled, Fan + shield review policy, normal effects and muted master audio. This is the previously fixed earned-run case; no seed, build or route search is used to obtain a timing pass. The public review pilot uses ordinary movement and earns its cards. It is not human playtesting.

URL pattern: `/game/overflight/play.html?operation=riy&layout=relay-ruins-receiver-gardens&seed=202604&reviewBuild=fan-shield&autoplay=1&benchmark=1&trial=N&measureAt=180&diagnostics=1&lang=en`, with `N=1,2,3`. Start remains manual.

The first completed active render at 180 earned gameplay seconds arms a 30-second warm-up, followed by 120 seconds of completed rendering. Draft rendering, foreground stalls and replacement airframes remain in the attempt. No gameplay state, remains or clock failures are reset when timing arms. A run that ends before completing the window is incomplete, even if its retained samples meet cadence thresholds.

Conditions: Apple M4 Pro, macOS 26.7.1, Codex in-app Chromium 155, AC power, approximately 120 Hz display; actual viewport 936×1143 CSS pixels, DPR 2, backing canvas 960×540. Task-owned CPU workers and immutable production hosts are stopped; other desktop activity is not isolated. No video capture runs during timing. This does not substitute for the waived Iris Xe or Safari tests.

Pass requires valid capture, a complete window, average at least 59 rendered frames/s, p95 at most 18 ms, p99 at most 33.3 ms and fewer than 1% of intervals exceeding 33.3 ms. Original failures remain in the earlier reports.

Population high-water marks cover the whole attempt. Late populations must be described from timestamped resource samples inside the measured gameplay interval, with their sample count and range; they are not exact sustained peaks. Submission statistics include armed warm-up and measurement, while application simulation/clock statistics cover the whole attempt.

## Results

All three normal-effects trials are valid, complete passes. Each separately restarted the same earned sortie. [Verified summary](NATIVE-LATE-SUMMARY.json); [reproducible summary reader](summarize-late-native.mjs). The reader checks each decompressed raw SHA-256 against the manifest rather than trusting a copied result.

| Trial | Measured render seconds | Gameplay interval | Average FPS | p95 / p99 ms | Worst ms | Intervals over 33.3 ms | Draft seconds |
| --- | ---: | --- | ---: | --- | ---: | ---: | ---: |
| [1](native/late-riy-trial-1.json.gz) | 119.9990 | 210.00–328.18 | 119.60 | 10.8 / 13.0 | 67.4 | 0.0279% | 1.5060 |
| [2](native/late-riy-trial-2.json.gz) | 119.9965 | 210.00–328.20 | 115.81 | 12.1 / 18.1 | 92.0 | 0.0863% | 1.4996 |
| [3](native/late-riy-trial-3.json.gz) | 119.9933 | 210.00–328.20 | 119.97 | 10.2 / 11.1 | 26.3 | 0% | 1.5016 |

All three arm warm-up at exactly 180 gameplay seconds and begin measuring at 210 seconds. The table retains the exact assigned-interval totals reported by the raw captures; each protocol marks its full 120-second window complete. No samples or foreground stalls were removed. No trial required a retry.

The eight resource samples at 210–315 gameplay seconds are identical across the three trials: **139–973 alive**, **93–348 center-visible**, **94–384 rendered**, 0–60 effects and 16–179 pickups. These periodic ranges are not exact peaks; the larger renderer sprite margin explains rendered counts above center-visible counts. The terminal summary has the final tank spawned and not yet defeated, all ten earned choices selected, one airframe lost and two remaining. These trials cover a late surge and tank arrival, not a full boss victory or every map/build.

All eight samples retain one canvas and 28,467,840 base atlas bytes. Stored remains reach their 1,024 limit without losing sequence accounting. Sprite allocation grows from 833 to 1,843 as the later workload develops; that is pool growth, not by itself a leak conclusion. Context losses, dropped simulation time and raw overflow are zero.

One separately restarted [reduced-effects comparison](native/late-riy-reduced-trial-1.json.gz) is also a valid complete pass: 119.9924 assigned seconds, 119.93 FPS, p95 **10.3 ms**, p99 **11.3 ms**, worst 18.4 ms, no intervals above 33.3 ms and 1.5020 seconds of draft rendering. It uses the same parameters and changes only the shared Accessibility setting before starting. This is one comparative observation, not another three-trial qualification set.

It arms at 180 seconds, begins measurement at 210, and ends at 328.20. Compared with normal trial 2 at the same tick, every run-summary field except `appearance` is identical: project identity, enemy/reward/damage counts, airframes, all ten upgrade IDs/ticks, objective state and escort statistics. The eight sampled enemy, pickup and stored-remains populations also match. Cosmetic effect samples peak at 32 rather than 60; allocated sprites span 761–1,740 rather than 833–1,843. It preserves one canvas and the same base atlas budget. This demonstrates the sampled quality setting changes presentation without changing this run's gameplay; it does not prove every combination or device.

Normal effects and Standard difficulty were restored through shared Settings after the comparison. The following soak uses normal effects and the separate reference workload.

The retained [raw manifest](native-full-content-summary.json) also contains earlier opening-to-elite and controlled-workload observations, each with its own source revision. They are not relabeled as this candidate.
