# Bounded regional streaming workload — 2026-10-15

The shared regional flight and verified mixed-window code completed a deterministic Node workload of 48,000 accepted fixed steps at 50 Hz: **960 seconds of simulated time**, not elapsed play time. The generated six-cell terrain/scenery strip was traversed in both directions with seven reversals and 37 local-origin recentres. Every step remained active, no contacts occurred, and asynchronous scene adoption never changed the accepted physical body. This exercises continuous free flight beyond the ordinary scored-flight time limit without introducing score or recording claims.

The workload uses production flight, collision and verified geometry admission, with synthetic source responses and feedback-driven self-level inputs. It does not render frames. Regional module hashes remained unchanged across the run; the checkpoint and exact hashes are in the companion receipt. The source checkpoint includes unrelated pending Library UI work, which this workload does not exercise.

| Exposed quantity | Maximum observed |
| --- | ---: |
| Loaded geometry bytes | 152,856 |
| Loaded source bytes | 127,308 |
| Reserved geometry bytes, including staging | 8,693,600 of 10,485,760 |
| Reserved source bytes, including staging | 254,616 of 33,554,432 |
| Loaded scene meshes / geometries / materials | 9 / 9 / 2 |
| Committed cells | 3 |

After disposal, the flight root had no children and reported geometry/source/reservation sizes were zero. These are exposed ownership and admission counters, not total process heap, GPU memory or collider allocation measurements; the mixed-window public snapshot does not expose collider counts.

A second bounded workload performed **30 corrupt-stage rejection → valid retry cycles** between opposite ends of the strip. Every rejected stage retained the previous verified geometry and provenance, each valid retry restored readiness, and final disposal returned source/geometry reservations to zero with no committed group. No player store, package cache or real network outage was involved.

## Evidence and remaining qualification

Companion JSON records exact module hashes, source checkpoint, fixture/output hashes and observed counts. External scripts and raw outputs are preserved under `/Volumes/alex/CodexMigrationStaging/fpv-temp/` as `regional-sustained.mjs`, `regional-sustained-output.jsonl`, `regional-repeated-recovery.mjs` and `regional-repeated-recovery.json`. Initial tuning stopped at the reversal-count assertion; the final run uses 48,000 steps and passed. A separate attempt against an incomplete sparse checkout did not start because a dependency was absent and is excluded.

This is not browser-rendered performance, a physical-device result, a two-hour session, actual quota recovery, full-world traversal or packaged offline admission. The next player-facing qualification remains the exact combined Library package: immutable download, explicit Fly, disarmed startup, retained installation and offline reopening. Longer native/device workloads and renderer/GPU resource observations remain separate acceptance items.
