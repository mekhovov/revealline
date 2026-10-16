# Bounded native renderer observations — 14 October 2026

Nine static first-course samples measured Mountain Reservoir, Harbor Docks and Coaster Park at Performance, Balanced and Quality presets. The actual native in-app browser used a **1280 × 800 viewport, DPR 1, and 1280 × 520 CSS/backing canvas**. Each explicit measurement discarded 30 warmup frames, then observed 120 rendered frames. The drone remained disarmed at tick zero; no context loss occurred.

The observed draw-callback CPU p95 was **0.60–1.20 ms**; requestAnimationFrame interval p95 was **8.80–9.20 ms**. These are separate measurements: callback time excludes asynchronous GPU completion, and animation cadence is not a gameplay FPS guarantee.

| World              | Preset code | Draw CPU mean (ms) | Draw CPU p95 (ms) | rAF interval mean (ms) | rAF interval p95 (ms) |
| ------------------ | ----------- | -----------------: | ----------------: | ---------------------: | --------------------: |
| Mountain Reservoir | balanced    |               0.89 |              1.00 |                   8.34 |                  9.20 |
| Mountain Reservoir | low         |               0.61 |              0.80 |                   8.33 |                  9.20 |
| Mountain Reservoir | high        |               1.06 |              1.20 |                   8.33 |                  9.00 |
| Harbor Docks       | high        |               0.95 |              1.10 |                   8.34 |                  9.00 |
| Harbor Docks       | balanced    |               0.79 |              1.00 |                   8.34 |                  9.00 |
| Harbor Docks       | low         |               0.55 |              0.70 |                   8.33 |                  9.00 |
| Coaster Park       | low         |               0.44 |              0.60 |                   8.33 |                  8.80 |
| Coaster Park       | balanced    |               0.55 |              0.70 |                   8.33 |                  8.90 |
| Coaster Park       | high        |               0.57 |              0.70 |                   8.34 |                  9.20 |

Preset codes `low`, `balanced`, and `high` correspond to Performance, Balanced, and Quality. The [full receipt](fpv-native-render-measurement-20261014.json) retains native visible JSON, exact pack/course identities, browser user agent, viewport/canvas measurements, callback and interval maxima, and external raw-evidence and harness hashes.

## Method and limits

The separate external harness used the unchanged production renderer from source `25d086cbd580de5dc5b745ce088af283434df5ae` and exact previously verified pack bytes. Measurement ran only after an explicit button press. Controls were disabled for the finite sample; a hidden tab, changed/zero dimensions, unavailable graphics or context loss invalidated it. No input or physics advancement was introduced.

An initial Reservoir sample reported zero window dimensions. It is **excluded**, not a usable baseline. The harness was corrected to capture a positive visualViewport/window/document-root basis plus actual canvas CSS/backing dimensions, and reject zero or changing sizes. All nine reported samples used valid identical dimensions.

The browser identified itself as Chrome 155 on macOS; its full user-agent string is preserved without inferring physical hardware from that string. This is not a before/after optimization comparison, sustained flight workload, mission-completion run, input-latency/GPU timing result, named-device FPS claim or all-world/preset acceptance. The short samples should inform further profiling, not an automatic graphics-preset decision.
