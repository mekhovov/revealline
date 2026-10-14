# Dense stress workload — retained attempts

There are three valid local observations: the original trial 1 on `3bb1b0dc6`, trial 2 on the later integration, and one bounded repeat of trial 3. The original third attempt remains invalid. Three consecutive attempts were not all clean.

Every run uses 30 seconds of warm-up and 120 seconds of completed-render measurement, with 2,500 simulated enemies, 1,200 visible and rendered, 480 pickups, four heavies, eight specialists, native full-build effects and the existing controlled recycling policy. No actor sampling, quality reduction or changed threshold was used. These are engineering workloads, not gameplay scores or ordinary enemy lifetimes.

| Attempt | Source | Average FPS | p95 ms | p99 ms | Worst ms | Frames >33.3 ms | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| [Trial 1](native/stress-trial-1.json.gz) | `3bb1b0dc6` | 99.61 | 17.00 | 25.50 | 47.40 | 0.1673% | Pass |
| [Trial 2](native/stress-trial-2.json.gz) | `186d8b748` | 120.07 | 10.70 | 12.40 | 84.50 | 0.0069% | Pass |
| [Trial 3](native/stress-trial-3.json.gz) | `3b120c945` | 119.73 | 11.10 | 13.70 | 268.00 | 0.0139% | Invalid: dropped catch-up time |
| [Trial 3, bounded retry](native/stress-trial-3-retry.json.gz) | `3b120c945` | 119.95 | 10.40 | 11.90 | 54.50 | 0.0069% | Pass |

The original third attempt includes a 268 ms foreground interval. The fixed-step clock reports 0.006 seconds of dropped catch-up time and therefore invalidates the trial even though its cadence percentiles meet the numerical targets. This interval was not removed, transformed into a pause or relabeled a pass. One bounded repeat used the same fixture, seed, settings and thresholds, with no dropped simulation time. A fresh browser profile was also opened during the invalid attempt; the repeat avoided opening another live renderer. This does not establish the cause of the original stall.

The original valid trial is preserved in [earlier native results](NATIVE-PERFORMANCE.md); the later raw downloads, hashes and settings are in [the current manifest](native-full-content-summary.json). Neither later integration changed stress gameplay parameters. The draft-render instrumentation fix applies to later recordings but does not add draft time to this draft-free fixture.

Conditions are the available M4 Pro, macOS and Codex Chromium setup: 936×1143 CSS viewport, DPR 2 and 960×540 backing. This is not a test of the waived external laptop or the requested 1080p viewport. The [15-minute soak's](SOAK.md) retained p95 failure remains separate; these observations neither override it nor establish leak freedom.
