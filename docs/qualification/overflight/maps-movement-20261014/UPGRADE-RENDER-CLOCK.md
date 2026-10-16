# Continuous render measurement through upgrade drafts

The [initial full-content Survivor trial](native/full-survivor-draft-interruption.json.gz) remains **invalid**. Its measured window completed with 10.5 ms p95, 12.9 ms p99 and no intervals above 33.3 ms, but ordinary upgrade phases had interrupted render sampling. The old capture is not relabelled as a pass: missing draft intervals cannot be reconstructed. Its decompressed SHA-256 is `8efc7ad59f89e2452490563ab710d4f1ae1c389aa1745bc1d5cc5a8f973275a1`.

The renderer previously enabled measurement only while the run was `playing`, before the host updated its phase. A normal earned draft changes the run to `upgrade`, so the next frame called the benchmark with an inactive state and marked the trial `interrupted`.

## Bounded correction

- `renderer.mjs` determines measurement activity **after** its host callback and includes both `playing` and `upgrade`. Card preparation and preview work therefore remain inside the completed render interval, including work during the transition into the draft.
- `benchmark.mjs` keeps the same cadence windows, raw intervals, thresholds and invalidation rules. It labels each raw interval with the run phase at completed render and reports sample counts and seconds by phase in every window.
- Draft time counts toward the measured rendering window as wall time, while simulation remains paused. Phase labels describe the interval’s ending state; they do not claim precise subdivision of a transition frame.
- Manual pause, hidden document, context loss, renderer failure and unfinished-run interruption retain invalidation. Foreground stalls are never excluded as draft overhead.
- No combat, progression, timing of simulation, input, reward or difficulty rule changed. The headless matrix’s 33-file simulation dependency closure excludes the two measurement files and remains bound to `ed46c2b72e1735940acd70337f4ca5826506b1cc`.

The additional retained phase array uses one byte per cadence sample (120,000 bytes at the existing default capacity). It does not add per-frame DOM work or texture operations.

## Verification

The renderer test drives real core transitions: salvage collection opens a legal draft, simulation time stays fixed while draft frames render, a legal card resumes play, and manual pause/resume returns to the interrupted draft. The test also inserts **220 ms of foreground work during the draft transition**; the resulting **236 ms interval remains recorded and causes the cadence gate to fail**, without making the trial invalid.

Separate cases confirm normal draft rendering can pass, while manual pause, hidden document and graphics-context loss cannot. Phase seconds sum to the complete measured window.

The [focused test log](upgrade-render-clock-tests.txt) records **32/32 passing renderer and trial-report tests**. ESLint passed for the two measurement files and the renderer test. New native captures are required for a full-content timing claim; this correction does not retroactively repair older measurements.
