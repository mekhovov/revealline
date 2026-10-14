# Fifteen-minute reference soak

**Lifecycle completed; performance did not pass.** The frozen runtime at `3bb1b0dc66ae77baf59d0e89ab9edf257a244d10` completed the 30-second warm-up and 900-second measurement window without a crash, context loss, simulation-time drop or raw-sample overflow. Its measured p95 cadence was **22.60 ms**, above the unchanged 18 ms target.

Evidence was captured at 2026-10-14 15:12:00 UTC in the Codex in-app Chromium browser. The reference workload retained 1,500 simulated and 700 center-visible enemies, a 960×540 backing canvas, and viewport 936×1143 at reported device-pixel ratio 2. Background build activity and other desktop work were present; these observations are retained rather than excluded from the result. No video recording was active. External reference hardware was not tested.

## All 62 resource samples

The analysis uses every resource sample from 0 through 915.10 simulation seconds, plus the terminal renderer snapshot. Samples are approximately 15 seconds apart; the final scheduled resource sample was before the measurement ended.

| Resource | Observed result |
| --- | --- |
| Canvas ownership | Exactly one canvas in all 62 samples |
| Base atlas accounting | Exactly 28,467,840 bytes in all 62 samples; this is sprite/world texture accounting, not total browser/GPU memory |
| Simulation pool capacities | Unchanged: 2,500 enemies, 2,048 pickups, 512 effects |
| Pooled sprites | Grew from 1,355 to a high-water mark of 1,843; unchanged in all 29 samples from 495.05 seconds onward and in the terminal snapshot |
| Context losses / restorations | 0 / 0; restoration is tested separately |
| Fixed simulation steps | 55,801; dropped time 0 seconds |
| Raw sample overflow | 0 |
| Heap used | 51,112,505–119,408,327 bytes; first 51,475,642, last sampled 58,969,502 bytes |
| Heap allocated | 73,236,739–182,106,935 bytes; first 144,014,226, last sampled 121,191,598 bytes |

Sprite allocation growth was sampled at: 0 s →1,355; 15 s →1,801; 60 s →1,808; 135.02 s →1,815; 150.02 s →1,823; 435.05 s →1,829; 495.05 s →1,843. The later plateau supports bounded pooled-sprite ownership in this workload.

Heap values fluctuate with allocation and collection. They are observational snapshots, **not proof that no objects leak**. They do not identify retained owners or GPU driver allocations, and raw diagnostic samples intentionally accumulate during the run. No forced collection or retained-object comparison was performed.

## Timing result

| Measurement-window criterion | Observed | Result |
| --- | ---: | --- |
| Average render-callback cadence ≥59/s | 87.52/s | Meets this threshold |
| p95 ≤18 ms | 22.60 ms | **Fails** |
| p99 ≤33.3 ms | 30.10 ms | Meets this threshold |
| Fewer than 1% of intervals above 33.3 ms | 0.548% | Meets this threshold |

The measurement window contains 78,764 raw intervals and reports 899.9861 seconds of assigned interval duration. The protocol marks the full window complete. Its worst interval is 258.20 ms. These foreground stalls remain in the evidence. The whole-trial submission p95 is 2.80 ms, which does not account for all host/browser/GPU work; see [the timing audit and bounded follow-up plan](PERFORMANCE-INSTRUMENTATION.md).

The capture is valid (`trialValid: true`, no invalid reasons), but `renderer.protocol.acceptance` is **false**. The current Phaser target setting does not cap rendering at 60 callbacks/s. Do not treat the high average cadence as a substitute for the failed p95 requirement.

## Evidence and limits

- [Complete compressed raw capture](native/reference-soak.json.gz)
- [Summary containing all 62 original resource samples](SOAK-SUMMARY.json)
- Decompressed raw SHA-256: `b9547ec71e4f6a77be7b82bd5c78045cfc1e1ce14964e5769085a8e5e06a7db6` (verified)

This establishes sustained local execution and bounded observed ownership for the reference fixture. It does not qualify every full-content operation, visual/audio mix, external target device, context-restoration path or human difficulty. The retained failed cadence result remains separate from the successful lifecycle completion. Quiet repeat trials and, if needed, a separate profiling capture should determine the remaining timing work without weakening the gate.
