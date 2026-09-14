# Relay Rescue — shared arena prototype

Target version: **0.45.0**. This checkpoint implements the two-player cutting experiment. Phase 3 replaces its temporary 0.65-second reserve recovery with the full helping loop. No human enjoyment or device qualification is inferred from automated checks.

## Decisions and independent review

One co-op simulation owns the 72 × 36 grid, two command samples per 120 Hz tick, enemy movement, trail ownership and a shared result. It exports its own create/start/step/pause/resume/release/summary/validation interfaces. The Race simulation and historical replay identities stay separate. The prototype writes no progress or solo awards.

Joint Cuts require a fresh meeting of active heads. Enemy contacts at earlier or equal times invalidate a cut first. Individual returns, joint banking and helpful prefix banking resolve monotonically; each newly safe cell is counted once. Allies do not retain hostile regions. In the comparison configuration, head meetings do not join and an intersected prefix does not receive the extra banking benefit; already-safe craft still return safely.

Independent review found and fixed:

- A fresh latched direction arriving before the required release tick could be ignored indefinitely. A per-seat command adapter now supplies one neutral simulation tick while preserving new steering. Seven integration tests exercise actual input and simulation behavior, including mixed seats and held inputs.
- A frame error stopped the menu controller as well as play. The host now keeps menu input running while the faulted simulation is paused, allowing an explicit retry.
- The drawn line understated its full-cell collision footprint. A cell-wide trail underlay now marks the exposed area; the craft's bright center identifies the actual meeting point, with separate numbered markers.
- Comparison instructions overstated independent return requirements. The copy now states the actual difference: head meetings do not join.

Research decision: keep this an executable mechanics experiment before finished content. [Moving Out 2's designer](https://blog.playstation.com/2023/08/14/designing-moving-out-2-to-be-more-fun-diverse-and-inclusive/) describes testing interactions in primitive levels and rejecting stationary helper duties. Here both players use the same movement and cutting tools, and the map supports individual or shared routes. The first real paired test remains a Phase 3 gate.

## Reproducible experiment

`game/test/coop-experiment.test.mjs` runs actual public commands on the unchanged authored First Connection arena with seed 17 and Standard difficulty. Both players boost inward along row 18, reposition on secured ground near columns 10/61, then cut downward.

| Measurement                     |           Joint Cuts |      Individual cuts |
| ------------------------------- | -------------------: | -------------------: |
| First bank                      |    tick 354 / 2.95 s |   tick 705 / 5.875 s |
| First bank territory            | 1,260 cells / 52.94% | 1,260 cells / 52.94% |
| Mission finish                  |    tick 772 / 6.43 s | tick 1,475 / 12.29 s |
| Final territory                 | 1,580 cells / 66.39% | 1,580 cells / 66.39% |
| Knockdowns / remaining reserves |                0 / 3 |                0 / 3 |

This deliberately practiced route proves that cooperation changes route length and exposure time. It does not establish normal completion time, balance or enjoyment. A real pair should learn each mechanic before comparing configurations and vary the order where practical.

## Verification and release ledger

Independent core and experiment suites: 26 passing tests, covering common-origin loops, head meetings, harmless trail crossings, contact ordering, partner prefixes, unique claims, symmetry, deterministic fixed ticks, pause, reserve accounting and a public-input clear. Input handoff suite: seven passing integration tests. Additional motion stress checks covered 300 simulated seconds and a 16-enemy obstacle arena. Browser smoke through real controls confirmed launch, both keyboard seats, a Joint Cut, shared territory, pause and same-setup retry. Physical controllers and a real two-human playtest remain pending.

Phase 1 source commit: `7690139d25511a2b6187a16e9c83d6cd8be0cef1` / **0.44.3**. Its pre-freeze baseline completed with 69/69 passing tests in 692.105 seconds; the after-fix parser/input/encounter subset passed 37/37. The initial Phase 1 report was committed while that baseline was running. Exact-commit clean-source validation, tests and build are recorded separately in `.cache/relay-rescue-artifacts/0.44.3/qualification.json` when complete.

Each immutable artifact is built from its committed tree in a clean temporary source directory. Package, lockfile root/package entry and build config versions advance together. Only these phase-owned files and hunks are staged. Original staged/unstaged/untracked workspace inventories were preserved under `.cache/relay-rescue/baseline` in the original checkout; all implementation commits live on `codex/relay-rescue`.
