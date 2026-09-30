# Local scene timing measurement

Measured 2026-09-28 at 22:21–22:23 UTC in Chrome 154 on the local macOS host, using the visible [measurement fixture](measure.html). CUA started the fixture through its button and read its rendered JSON report. Each row is one six-second sample after image decoding and a 500ms settling interval. The tab remained focused and visible, every image loaded, and both reports were valid. Other local validation jobs were running.

| Viewport (DPR 1) | Scene           | Motion  | Samples | Mean rAF interval |    p95 | Maximum | Intervals >34ms | Long tasks | Active CSS animations |
| ---------------- | --------------- | ------- | ------: | ----------------: | -----: | ------: | --------------: | ---------: | --------------------: |
| 1280×720         | FPV             | On      |     702 |            8.55ms |  9.3ms |  25.0ms |               0 |          0 |                     9 |
| 1280×720         | Spend in Motion | On      |     716 |            8.37ms |  9.2ms |  17.5ms |               0 |          0 |                    11 |
| 1280×720         | FPV             | Reduced |     710 |            8.44ms |  9.1ms |  25.1ms |               0 |          0 |                     0 |
| 390×844          | FPV portrait    | On      |     630 |            9.52ms | 16.8ms |  42.4ms |               1 |          0 |                     9 |
| 390×844          | Spend in Motion | On      |     706 |            8.49ms |  9.2ms |  33.6ms |               0 |          0 |                    11 |
| 390×844          | FPV portrait    | Reduced |     719 |            8.36ms |  9.2ms |  16.7ms |               0 |          0 |                     0 |

The browser's approximate `usedJSHeapSize` readings ranged from 7,951,640 to 9,106,694 bytes across samples. Heap values include the fixture, measurement arrays and browser-exposed page overhead; they are not isolated scene allocation or a leak test. Source bitmap RGBA estimates are 2,073,600 bytes for either FPV orientation (960×540 or 540×960) and 6,294,152 bytes for Spend in Motion (1774×887). These are decoded bitmap estimates, not GPU or process memory. The compressed active-image limit of 2 MiB is separate; the largest delivered scene is 700,570 bytes.

This measures scene-only rAF callbacks, not actual presented frames or complete game/menu responsiveness. The portrait run is a desktop browser viewport override, not mobile hardware or mobile CPU emulation. No physical phone, controller, native desktop executable, iOS app, battery, process memory or GPU memory measurement was made. The one portrait interval above 34ms is retained in the report rather than discarded. Reduced motion visibly reported zero active animations.

To repeat, serve the repository, open `docs/verification/menu-scenes/measure.html`, keep the tab in the foreground and select **Measure scenes**. The page emits all raw samples' summaries in its visible JSON result. Restore temporary viewport overrides when finished.
