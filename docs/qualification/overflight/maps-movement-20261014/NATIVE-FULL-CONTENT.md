# Native gameplay and Raid workload timing

14 October 2026. All three measured Single Drone runs, all three Riy runs and all three controlled Raid runs pass the local cadence thresholds. This is bounded evidence on the available M4 Pro, not qualification of the waived Iris Xe laptop or every map/build/late-run state.

Each trial starts fresh, warms up for 30 seconds, then retains 120 seconds of completed rendering. Ordinary upgrade drafts are included. Manual pause, hidden pages, context loss and measurement overflow remain invalidations. Long frames are retained; recordings were made separately.

| Run                        | Source      | Average FPS | p95 ms | p99 ms | Frames >33.3 ms | Local result |
| -------------------------- | ----------- | ----------: | -----: | -----: | --------------: | ------------ |
| Single Drone 1             | `b12d4a134` |      119.98 |   9.50 |  10.50 |          0.000% | Pass         |
| Single Drone 2             | `4dab801d9` |      120.17 |  10.20 |  12.50 |          0.000% | Pass         |
| Single Drone 3             | `4dab801d9` |      120.54 |   9.70 |  12.00 |          0.048% | Pass         |
| Riy 1                      | `4dab801d9` |      120.53 |  10.10 |  12.80 |          0.048% | Pass         |
| Riy 2                      | `e914f3bdd` |      120.03 |  10.50 |  12.60 |          0.007% | Pass         |
| Riy 3                      | `0b1aa412d` |      119.96 |   9.50 |  10.30 |          0.007% | Pass         |
| Raid controlled workload 1 | `0b1aa412d` |      119.85 |   9.60 |  11.00 |          0.014% | Pass         |
| Raid controlled workload 2 | `0b1aa412d` |      119.89 |  10.30 |  12.30 |          0.007% | Pass         |
| Raid controlled workload 3 | `186d8b748` |      119.79 |  10.30 |  12.90 |          0.021% | Pass         |

## What these workloads establish

- **Single Drone:** Haul Switchbacks, seed 17031991, Fan preference, Standard and three airframes. Normal earned upgrades and an early evolution; peak 101 alive / 69 visible. Each measured window includes about eight seconds of draft rendering. These runs cover the opening through elite arrival, not the final tank or a 600–800-visible surge.
- **Riy:** Loading Loop, same seed/difficulty/airframes, Echo preference. Both escorts, Focus, real upgrades and an evolution; peak 165 alive / 106 visible. About 7.5 seconds of draft rendering per window. These are opening-to-elite workloads, not complete sorties.
- **Raid:** explicit `raid-reference` engineering fixture, Broken Crossroads, 403 alive / 200 visible, moving contact attacks, projectiles, armor and maximum modules. Its actors recycle in the same pools and progression is disabled. It measures sustained combat capacity; its kills, chain and completion are not ordinary gameplay results. Separate baseline-kit Raid/Marathon completion evidence remains in [Raid qualification](RAID-QUALIFICATION.md).

The frozen JSON summaries can show the run phase at the end of capture, including an ordinary draft. That does not invalidate the completed-render window. The original pre-fix draft-interrupted capture is preserved as invalid in [the instrumentation finding](UPGRADE-RENDER-CLOCK.md).

## Conditions and source boundaries

Apple M4 Pro, 48 GB, macOS 26.7.1, Codex Chromium 155, roughly 120 Hz, AC power. Actual viewport **936×1143 CSS pixels, DPR 2**, game backing 960×540, normal effects, Scout with balanced handling, master muted. A requested 1920×1080 override did not apply, so this is not a 1080p viewport claim. Other desktop applications remained open. Production preparation overlapped some earlier trials; the second Riy run also overlapped a brief separate offline-game check. All intervals remain in the files; this was not an isolated machine test.

The per-trial source column identifies the checked-out version when started. Later integration/launcher changes did not change Overflight combat, sprites or submission code. Survivor trial1 uses the draft-clock fix at b12; subsequent trials retain it. Source changes are not silently attributed to the older 3bb generation.

Raw UI downloads, SHA-256 hashes, exact settings, phase coverage and high-water counters are in [the measurement manifest](native-full-content-summary.json). Read the [earlier reference results](NATIVE-PERFORMANCE.md) and [soak](SOAK.md) alongside these passes: their original p95 failures remain failures. Stress repeats have separate fixture labels and cannot substitute for actual gameplay or readability review.
