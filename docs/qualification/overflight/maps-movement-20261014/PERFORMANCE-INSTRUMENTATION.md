# Performance measurement audit and bounded follow-up

14 October 2026. Read-only audit of runtime commit `3bb1b0dc66ae77baf59d0e89ab9edf257a244d10` and the three retained native reference trials. No runtime instrumentation, frame cap, quality reduction or acceptance-threshold change was applied.

## What the existing evidence says

All three trials are valid, completed recordings of the defined local fixture. All three fail its p95 cadence requirement. Validity means that interruptions, dropped simulation time and recording overhead did not invalidate the trial; it does not mean that performance passed.

| Trial | Measurement-window cadence | Measurement-window p95 / p99 | Intervals above 33.3 ms | Recorded submission p95 | Warmed simulation p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 96.19 callbacks/s | 21.70 / 28.10 ms | 0.321% | 2.60 ms | 2.00 ms |
| 2 | 96.08 callbacks/s | 18.80 / 27.20 ms | 0.243% | 2.90 ms | 2.40 ms |
| 3 | 84.34 callbacks/s | 24.30 / 30.40 ms | 0.573% | 2.90 ms | 2.50 ms |

Cadence values above are the individual `renderer.protocol.windows[0]` results after warm-up. Submission p95 is the report's existing whole-trial distribution, including warm-up; simulation p95 was calculated from preserved samples at ticks ≥1,800. These are separate distributions and must not be added to estimate a joint frame percentile.

Sources: [trial 1](native/reference-trial-1.json.gz), [trial 2](native/reference-trial-2.json.gz), [trial 3](native/reference-trial-3.json.gz). Each has 1,500 simulated enemies, 700 center-visible enemies and a 960×540 backing canvas. The records report one canvas and a 28,467,840-byte base atlas.

Host update-start interval p95 is also elevated: **21.0 / 17.4 / 24.3 ms** after 30 gameplay seconds. Thus the missed cadence cannot be dismissed as only jitter in the post-render timestamp. Trial 2 additionally crosses the 18 ms threshold between update-start and render-end distributions; this alone does not identify which work caused it.

## Timing boundaries that matter

| Existing measurement | Included | Not established by it |
| --- | --- | --- |
| `stepCPU`, `game/overflight/app.mjs:1334–1342` | `mode.step()` and evaluation of its input argument, including the selected review input policy | Input-device sampling, audio update, commentator update, transitions, HUD, music, diagnostic serialization and browser layout/compositing |
| `presentMs`, `game/overflight/renderer.mjs:350–902` | Sprite/cue/remains preparation and pooled sprite updates in `present()` | The rest of the host update, Phaser's outer frame work, DOM rendering or GPU completion |
| Submission, `game/overflight/renderer.mjs:191–197` | `presentMs` plus elapsed time between Phaser Core PRE_RENDER and POST_RENDER callbacks | Phaser frame work before PRE_RENDER; asynchronous GPU execution and actual display presentation |
| Render cadence, same POST_RENDER callback | Raw intervals between completed JavaScript render submissions; foreground stalls are retained | A hardware fence or compositor-confirmed displayed-frame timestamp |

There is a specific source-level blind spot in the submission timer. Bundled Phaser's `node_modules/phaser/src/core/Game.js:474–502` performs scene update, POST_STEP and **`renderer.preRender()` before emitting Core PRE_RENDER**. Our timer begins at that later event. The WebGL frame setup/clear in `node_modules/phaser/src/renderer/webgl/WebGLRenderer.js:1960` is therefore outside the submission span. This is a reason to measure the whole frame; it is not evidence that clearing is slow.

The current capture cannot subtract the reported simulation and submission values from cadence and call the remainder one specific cost. Cadence also contains browser scheduling, time between callbacks and asynchronous presentation. Simulation samples carry a tick rather than a common render-frame identifier, and high-refresh frames sometimes have no simulation step.

## The fixture is not capped at 60 render callbacks/s

`game/overflight/renderer.mjs:219` configures `fps: { target: 60, forceSetTimeOut: false }`, with no `limit`. The bundled source documents `target` as advisory and `limit` as the enforced cap (`node_modules/phaser/src/core/typedefs/FPSConfig.js:6–7`; `TimeStep.js:113–169,553–555`). This agrees with the measured 84–96 callbacks/s and roughly 9 ms median intervals.

Record the actual display refresh/variable-refresh and power configuration when available. These results are local browser evidence, not a claim that the requested 60 Hz reference device was tested. **Do not introduce an FPS cap as a way to make the current gate pass, discard these failed trials, or relax the 18/33.3 ms thresholds.** Any later cadence-policy experiment needs its own labeled comparison.

## Concrete unmeasured work to inspect

1. **Whole host update.** `app.mjs:1320–1428` includes input, per-step audio/commentator calls, world display snapshots, rotor updates and phase transitions around the measured simulation/presentation sections. Measure this enclosing span before optimizing one component.
2. **HUD at approximately 10 Hz.** `app.mjs:642–746` rewrites text, attributes and width styles, formats numbers, builds temporary arrays and updates touch/operation overlays. Browser style/layout caused by those mutations can occur after the function returns. The code is a plausible periodic source to correlate with a trace; no duration is currently recorded.
3. **Music at approximately 20 Hz.** `app.mjs:1389` calls the shared player's update; `game/ui/soundtrack-player.mjs:1556` updates gains, soundscape and transitions. No phase timing is recorded.
4. **Visible diagnostics every two seconds.** When its details panel is open, `app.mjs:1407` calls `renderer.stats()` and serializes the result into the DOM. `game/overflight/benchmark.mjs:130–205` scans and sorts retained timing samples to build distributions. Record whether the panel was open during a trial before attributing stalls to this path. Normal benchmark capture opens it at completion; an earlier manual opening is not recorded in existing metadata.
5. **Allocations and browser GC.** Raw frame/sample objects, display snapshots and per-step audio event sorting allocate. Heap samples show collection cycles rather than monotonic growth, but their 15-second spacing cannot connect a collection to a missed frame. A browser allocation/GC trace is needed before selecting an optimization.

Some attractive explanations are not supported by these fixtures. All three captures report `masterMuted: true`. `game/ui/feedback-director.mjs:482–499` short-circuits rotor playback while muted; `game/overflight/world-audio.mjs:41` bypasses ambience in fixtures; `game/overflight/commentator.mjs:93` bypasses fixture commentary, and the captured commentator cache/incidents are empty. The audio adapter still does event preparation and sorting, so its CPU should be measured, but live sound mixing or spoken reactions are not established culprits. Upgrade preview canvases run only while the upgrade dialog is open; this reference fixture has no drafts. Native presentation reuses prepared textures and pooled sprites, and the fixture retains no remains; repeated atlas painting or dense gore cannot be assumed from these captures.

## Bounded next steps

1. **Finish the current build, then repeat the three unchanged trials quietly.** Preserve the existing failures. Record commit, browser, viewport/backing canvas, display/power information available, diagnostics-panel state, mute/quality settings, foreground state and whether build/qualification workers are active. Keep the same seed, warm-up, workload and acceptance thresholds.
2. **If p95 still fails, capture one separate 20–30-second browser performance trace after warm-up.** Include JavaScript stacks, GC, style/layout/paint and browser frame/scheduler information. This is diagnosis, not a replacement qualification trial; profiling overhead must not be mixed into the accepted sample set. Long-task-only reporting is insufficient because most problematic intervals are 18–33 ms, below its usual long-task threshold.
3. **Only if the trace cannot isolate the missing time, add bounded diagnostic spans in a separate change.** Use a shared frame sequence plus `performance.now()` timestamps for the whole Phaser step, whole host callback, simulation, audio/commentator, HUD, music, `present()` and actual WebGL pre-render setup. Store bounded numeric buffers; serialize after measurement. Keep the existing cadence measurement unchanged. Do not sum overlapping spans or insert blocking GPU synchronization into normal play.
4. **Change only the demonstrated hot path, then repeat the same comparison.** For example, redundant HUD writes, open-panel statistics sorting or event allocation should be optimized only if measured. Do not reduce enemy density, weaken simulation, omit warnings or infer a renderer regression from unrelated CPU contention.

No cause has been conclusively assigned yet. The immediate evidence gap is whole-frame attribution, not a demonstrated shortage of simulation throughput.

## Later measurement correction

The quieter three-trial reference repeat subsequently passed; [NATIVE-PERFORMANCE.md](NATIVE-PERFORMANCE.md) preserves both conditions without assigning a cause to the earlier failures. A separate full-content run exposed an upgrade-phase measurement bug, corrected in [UPGRADE-RENDER-CLOCK.md](UPGRADE-RENDER-CLOCK.md). New renderer intervals include ordinary draft wall-time and expose phase coverage. The host/simulation arrays remain gameplay-only, so the equal-index CPU join used for the original no-draft fixture must not be reused for full-content captures with drafts. This does not change the cadence thresholds or remove foreground stalls.
