# Bounded preparation lifecycle observation

The native five-minute 611 diagnostic retained its LoAF associations, but its four in-run preparation spans timed only the initial call to the async renderer method. Synchronous work after internal awaits was outside that submit span. The existing renderer already returns per-transition receipt aggregates; the authoring report kept only the initial receipt and overall maximum. Four preparation-submit spans coincide with four actual LoAF rows, which is an association and does not identify the slow descendant or cause.

The authoring observer now retains eight preparation lifecycle observations. Each records the wrapper start, the observed await-settlement end, observer receipt time, outcome and a sanitized copy of the existing renderer receipt. Start/end differences and `compileWaitMs` include asynchronous waiting. `uploadCpuMs` is the renderer's synchronous upload-submission wall time, not exclusive CPU or GPU completion. Receipt sequence is the latest existing renderer receipt read on successful wrapper completion; this does not provide timestamps for individual internal continuations.

At each LoAF observer receipt, at most two overlapping lifecycle examples are copied alongside their known count, example-drop count and overwritten-history disclosure. Later completion, mutation, ring overwrite and finalization cannot rewrite those earlier associations. Pending, rejected, cancelled, missing and overwritten observations do not become successful flight progress. Stop drains available entries and freezes the observer; later completion cannot rewrite a stopped report.

An enclosing `frame-callback` synchronous wall span additionally covers the authoring callback body and animation-frame submission. Nested named phases remain available and cannot be summed as exclusive CPU. The final callback can remain unfinished when finalization stops the observer; it stays unknown. No promise or timer is added for this observation.

All runtime calls, compile/upload/adoption ordering, prior report aggregates, the 20 ms clock, 250 ms gap limit, route, duration and focus rules are preserved. This does not instrument production internals or fix a measured production performance cause.

Validation: 15 focused tests pass, including nine new cases that fail against unchanged main; all seven existing attribution verifier groups pass. Cases cover distinct start/end/receive offsets, synchronous gap versus async wait, history and per-LoAF caps, late completion, cancellation, unknown/invalid values, mutation, teardown, privacy and saturated payload below 128 KiB. Injected test timestamps are diagnostic regressions, never elapsed flight.

Exact-head cloud checks, independent review and a fresh exact native bounded diagnostic remain pending. The earlier 611 native acceptance is not relabelled as acceptance of this source. Actual two-hour/full-route, causal JS/GC/scheduling, physical-device and public acceptance remain open. Native Codex/IAB inspector access was refused for safety; no inspector opened and no bypass was attempted.

See `docs/evidence/fpv-endurance-preparation-observer-20261015.json`. The LoAF processing model includes microtask-checkpoint timing and limited script exposure, so a frame-entry caller does not identify the expensive descendant: [W3C working draft](https://www.w3.org/TR/long-animation-frames/).
