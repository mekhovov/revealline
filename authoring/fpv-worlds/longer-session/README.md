# Bounded native Yard and Reservoir sessions

The exact final combined player passed **306/306 checks** in one 167.196-second
native-clock run on 4 October 2026 UTC (5 October locally). It reused admission
`0b54fd0fdf8fe06dc900024a8b59713340b09bb3`, tree
`e946452076002444bfea9cd7d320da095bf927b5`: 102 immutable player files, 95 source
inputs and no runtime overlays. Those 95 inputs are byte-identical to merged
main `21826c460e80fa4e7fa47ec8e6ba9f98f75beea4`. No additional package build was
made for this observation. Source reserve remains 35,578 bytes.

The [complete evidence manifest](evidence/native-8967-r1/manifest.json) binds the
lossless receipt, screenshot, fixture, admission inventory and exact observer
code. The raw receipt is 213,716 UTF-8 bytes, SHA-256
`03876d437b456228986ca2fff8ab659d1145b8948fd6ecd723b3e028fbafd9da`.
The [derived audit](evidence/native-8967-r1/audit.json) retains all eight windows,
coverage, profiles, resources and browser-reported identity.

The workload selected Yard08 → Reservoir08 → Yard08 → Reservoir08. Each selection
had one requested 20-second Ready window and one requested 20-second verified
Self-level replay at native 1×. Actual windows lasted 20,000.2–20,001.5ms; none
exceeded the disclosed 22-second diagnostic bound. Ready states retained exact
zero-tick spawn poses. Each replay window advanced 1,001 native ticks and was
then deliberately paused through Home, before proof completion. The replay
windows began at ticks 2 or 4, so their moving boundaries are recorded, not
claimed to be exact matched poses. No automatic resumption, private state writes
or clock substitution occurred. Inner public controls were scripted; the outer
Run action was trusted.

The actual authored profiles were **Operations** for the industrial Yard and
**Ukrainian Horizons** for Reservoir, with Authored appearance, Balanced quality,
FPV camera and keyboard selected. Exact Reservoir pack `50ffbb0e…` and its
separate sixteen-record archive `073ee3e3…` were uploaded through native File
controls. This did not duplicate catalogue download, editor faults or offline
qualification from the combined journey.

| Window | Scene / state        | Mean host callback ms | Mean draw submission ms | Mean left width read ms |
| ------ | -------------------- | --------------------: | ----------------------: | ----------------------: |
| 1      | Yard / Ready         |                 1.442 |                   0.604 |                   0.385 |
| 2      | Yard / playback      |                 1.734 |                   0.684 |                   0.478 |
| 3      | Reservoir / Ready    |                 1.850 |                   0.856 |                   0.498 |
| 4      | Reservoir / playback |                 1.801 |                   0.819 |                   0.481 |
| 5      | Yard / Ready         |                 1.757 |                   0.831 |                   0.440 |
| 6      | Yard / playback      |                 1.708 |                   0.688 |                   0.470 |
| 7      | Reservoir / Ready    |                 1.627 |                   0.735 |                   0.432 |
| 8      | Reservoir / playback |                 1.798 |                   0.779 |                   0.530 |

These nested CPU measures cannot be added as independent costs. The left-stick
`clientWidth` read accounted for 25.0–29.5% of observed host callback CPU, while
the following right read averaged 0.000875–0.001791ms. All observed structured
clones together cost 0.083–0.116ms per host callback. Observer overhead has a
recorded lower bound of 0.0228–0.0255ms per callback. Its wrappers preserve native
results; full snapshots occur outside the timed windows. The four observed
Ready attribute writes per callback were unchanged, but their direct measured
cost is small compared with the first width read. CSS/style setters outside the
observer's declared fields are not included in that DOM count.

Three same-owner Ready observations per scene had identical registered and
internal resource counts:

| Scene     | Owned geometries / materials / textures | Renderer geometries / textures / programs |
| --------- | --------------------------------------- | ----------------------------------------- |
| Yard      | 206 / 150 / 27                          | 106 / 24 / 20                             |
| Reservoir | 191 / 285 / 33                          | 136 / 30 / 17                             |

A fresh owner recreated the same Ready states and owned resource counts. Both
owners then reported zero registered geometries, materials and textures. The
renderer diagnostic retained one internal texture after disposal; this is
reported separately and is not treated as an application-owned leak. This run
does not measure ImageBitmap.close, heap retained size or all browser memory.
No errors, warnings, observer overflow or sampled focus/visibility loss occurred.

The browser reported Chrome154 on MacIntel, DPR2 and a 1280×662 iframe viewport.
Those fields do not identify or qualify physical hardware. Other chats could
share the browser service; unrelated tab/process contention was not measured.
Both Long Animation Frame and longtask observation were supported, but no
qualifying entries began inside these windows. The largest recorded native RAF
gap was 34.3ms: no 50ms LoAF entry does not mean no jank. This single-runtime run
supports neither a before/after speedup nor GPU, FPS or thermal-endurance claims.

The next bounded candidate is the recurring first width read in `paintInput`,
not a renderer/cache rewrite. The current code preserves each stick's exact
padding-box `clientWidth × 0.34` radius. A separate prototype should investigate
container-relative knob positioning or properly invalidated size observation,
then verify border/fractional-width rounding, both dimensions, hidden-to-visible
transitions, resize, touch/recording and Modes1–4 before any timing conclusion.
Removing a synchronous query may move layout work elsewhere; matched full host
callback measurements must establish the effect. No optimization is implemented
in this evidence increment.

For reproduction, use Node22 and call `prepare.mjs` with absolute arguments:
repository root, exact admitted player directory, its 95-input inventory, full
admission revision, immutable Reservoir pack, separate proof archive and a new
output directory. The preparer checks the source/working closure, stage and all
hashes before immutable hardlinking. It imports offline helpers through the
repository's verified ESM boundary. Serve the new directory, keep its player
visible/focused, and choose **Run eight native windows**. The pre-run design and
both generated HTML documents are retained in the evidence archive. Code bytes
are retained exactly as run, including their original formatting.
