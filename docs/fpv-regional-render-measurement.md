# Regional render measurement — 15 October 2026

The authoring renderer-preparation page now records a bounded 30-second visible-tab sample after a two-second warm-up. Select detail before loading and a camera before measuring. Manifest response SHA256/bytes, viewport, backing canvas, browser identity and before/after resources accompany the intervals and CPU draw costs. Changing focus, visibility, viewport, camera, preparation or releasing resources invalidates the sample. Input and physics are not included.

## Observed source check

Source `ceead1e1d428588df8338c114c49aad25a10a62f`, Mac16,7, macOS26.7.1 build25G241, Chrome155.0.0.0; 1280×720 viewport, 1650×648 backing canvas, DPR2 with Balanced cap1.5. The negative-coordinate diagnostic fixture uses256m cells; it is not an authored-world art benchmark.

- Terrain manifest SHA256 `151141edf1cc0b04f5db5a697af4a7effed17a5ed1d01f698331201ef9e66bbb`, 2756bytes.
- Scenery manifest SHA256 `6925e1403c2b0858543e6910543ceb5efa2cf965beac81d5558cf051d78c1bee`, 2744bytes.
- 2758 frame intervals over30006.4ms: median8.4ms, p9518.1ms, p9931.9ms, maximum94.7ms.
- CPU owner-snapshot/draw submission: median0.8ms, p951.3ms, p991.8ms, maximum7.8ms. This is not GPU execution time.
- Renderer stable before/after:86calls,8424triangles,41geometries,6textures,9programs. Owner resource/reservation101904bytes, source84904bytes.
- Declared-size neighbour staging adopted successfully. Release during a subsequent warm-up produced INVALID, then owner geometry and reserved geometry returned to zero.

Syntax, formatting, browser globals and unreachable-code checks passed. Full receipts are retained externally with the source verification artifacts.

## Limits and next work

Other paused browser tabs were present. This is a fixed-pose source observation, not a controlled before/after result, integrated-player FPS, GPU benchmark, physical-device matrix, long-session memory acceptance or package qualification. Repeat against representative authored regions and identical browser/workload before interpreting an optimization. No performance target is closed by this receipt.
