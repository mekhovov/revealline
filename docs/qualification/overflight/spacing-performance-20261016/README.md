# Local crowd-spacing performance follow-up

16 October 2026. Runtime `5f1906a46`. Stacked on the native parity/crowd
prototype in PR #1524. That PR's CI passed; its parent #1503 has merged, while
#1514 remains queued. Fetched main `b11745223` has no additional Overflight
runtime changes; this continuation preserves the published stack.

## Delivered

Experimental local spacing now uses a separate **16-pixel spatial index** over
its frozen body positions. The exact damage/contact grid retains its size,
candidates and ordering. The fine index is allocated only on the first local
query and reused through subsequent rebuilds. Existing project defaults and
legacy steering are unchanged.

This reduces distant-body work without truncating nearby neighbors, reducing
enemy count, changing attack parameters or weakening collisions. In the normal
2880×1080 arena with a 2,500-actor pool it adds **58,960 bytes** of CPU index
storage. There are no new textures, atlas pages, assets or offline dependencies.

Diagnostic reference/stress fixtures can now explicitly select the same authored
rule with `reviewCrowd=local`; ordinary starts and Raid ignore this diagnostic
override. Downloaded measurements identify the selected crowd rule directly.

## CPU comparison and correctness

`paired-cost.mjs` alternates the original 64-pixel implementation, a 32-pixel
candidate and the selected 16-pixel candidate within one process. Every scene has
30 warm-up and 120 measured iterations per implementation. All stalls are kept;
workstation load makes tails noisy. Exact source texts and hashes are retained
in `paired.json.sources.gz` / `paired.json`.

| Packed lattice | Original median | 32-pixel median | Selected 16-pixel median |
| --- | ---: | ---: | ---: |
| 1,500 actors | 4.00 ms | 3.36 ms | 2.01 ms |
| 2,500 actors | 7.58 ms | 4.65 ms | 3.17 ms |

Distributed-scene costs remain below 0.54 ms mean for these paired samples;
16-pixel indexing has a small distributed-scene overhead. Maximum measured force
difference is **5.34e-15**, from summation order. This is geometrically equivalent
steering within tolerance, not a promise of bit-identical long replays. The
previous native/headless outcome differences remain relevant.

These are **CPU kernels only**, excluding rendering, other simulation and audio.
`before.json` and `after.json` retain the initial sequential 64/32-pixel runs;
they are exploratory, not the chosen 16-pixel full-content measurement.

`host-checks.tap`: **45/45 passed** at the first implementation checkpoint.
The new tests cover brute-force nearby-body equivalence over variable radii,
rebuilds, inactive bodies and arena edges, plus frozen first-query positions,
bounded lazy allocation and diagnostic fixture admission. Exact-query ordering
and final regression results are retained separately after the native trials.
`fixture-before.tap` retains the initial missing-helper failure.

## Native frame trials

Available hardware: Apple M4 Pro, macOS 26.7.1 / build 25G241, AC power. Native
in-app Chromium 155, 120 Hz rendering cadence, 1280×720 viewport / DPR 2 and
960×540 backing. Standard shared presentation, Scout, normal effects and existing
muted master setting. This is the available Mac, **not** the waived Iris Xe or
Safari target. It is not a 1080p-viewport qualification.

Each reference trial starts from a fresh page, warms for 30 seconds and measures
120 seconds. No trace, video recording or headless simulation runs alongside
these trials. Downloads retain raw intervals, simulation timings, populations,
resource samples and unexpected stalls. `qualify.mjs` independently recomputes
frame gates from the raw measured window, including every long interval.

All three separately restarted reference trials passed with 1,500 simulated /
700 visible and no dropped catch-up time. The separate stress trial also passed.

| Trial | p95 | p99 | Measured render cadence | Whole-trial validity |
| --- | ---: | ---: | ---: | --- |
| Reference 1 | 10.9 ms | 13.0 ms | 119.85 Hz | Valid |
| Reference 2 | 10.7 ms | 12.8 ms | 119.84 Hz | Valid |
| Reference 3 | 11.1 ms | 13.3 ms | 119.88 Hz | Valid |
| Stress 1 · 2,500 / 1,200 | 11.3 ms | 12.5 ms | 119.96 Hz | Valid |

`qualification-final.json` independently confirms all three reference gates,
identical configuration across the restarts and the separate stress pass.

The fixture is a controlled capacity workload with recycled bodies and a fully
upgraded build. It does **not** establish real-sortie pacing, build viability,
enjoyment or complete release acceptance. Native gameplay, lifecycle and stress
checks remain distinct evidence.

## Regression and recovery

`regression-checks.tap`: **154/154 passed**, zero failed/skipped, including core
reference/stress/long fixture tests, local-force/runtime/editor/legacy checks,
shared host and input, squad/cover, world progression and offline navigation.
No application sources changed during the native frame trials.

A separate untimed native test requested actual WebGL loss and restoration.
The shared shell paused and opened Home. **Continue** was required to resume;
the simulation then reached tick 811 (13.52 seconds) with 1,500 / 700 actors.
`native-recovery.json.gz` records one loss, one restoration, no retained lost or
failed state, and correctly marks the timing record invalid for context loss.
`native-recovery.png` shows the restored scene.

One inspection attempt timed out while seeking the header Resume control behind
the modal Home menu. Rebinding the existing tab exposed Continue; the normal
UI action resumed successfully. This is not retained as a failed graphics
restoration or a timing pass. Ten native same-seed retries and a new 15-minute
soak remain open; the current core/host retry regressions do not replace them.

## Reproduce / review

Native reference trial:

`/game/overflight/play.html?fixture=reference&reviewCrowd=local&trial=1&benchmark=1&diagnostics=1&seed=202604&lang=en`

Repeat with trial 2 and 3 from fresh pages. Use `fixture=stress` for the separate
2,500-simulated / 1,200-visible workload. Start is manual. Each timing trial
pauses itself at completion; download its frozen measurements through the
normal Diagnostics control. Record video separately from timing trials.

The local-spacing option remains explicitly experimental in Creator Studio.
Neither default movement nor late-upgrade thresholds were silently changed.

## Remaining boundaries

- Complete actual dense-sortie checks, broad earned active/unattended coverage,
  ten retries/context recovery and the full content soak against the chosen rule
  before promoting it to normal projects.
- Compare later progression separately. Six predeclared paired configurations in
  `../late-pacing-20261016/plan.json` cover three build directions per mode; they
  are sampled coverage rather than a fully crossed balance matrix.
- Audible boss/full-mix acceptance, broad map readability and provisional medal /
  Marathon review remain separate items. External devices and five-player trials
  stay **skipped, not passed**, as waived.
