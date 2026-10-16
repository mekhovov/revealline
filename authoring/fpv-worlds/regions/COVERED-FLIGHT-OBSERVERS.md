# Covered retained-flight presentation

A prepared paused/disarmed flight no longer submits its covered scene or updates hidden HUD/control observers while the opaque mission chooser or Settings is open. The narrow guard follows device/menu polling, timing and audio. Active simulation, preparation, terminal results and the visible pause background retain their previous paths. Closing the cover restores presentation immediately.

`node authoring/fpv-worlds/regions/verify-covered-flight-frame.mjs` executes the actual production callback in ten focused scenarios. The existing preparation-clock, keyboard, controller-readiness, preparation-control and shared-shell checks also passed (61 tests).

## Bounded native investigation, 2026-10-15

The preserved instrumented baseline at origin 9135 observed a retained-flight replacement install taking 318,222 ms, including 317,152 ms in cursor deletion. A subsequent saved-region load took 38.825 seconds to verify its first 256 files while the chooser covered the retained scene. Without changing code, leaving the chooser let that baseline finish its remaining verification promptly.

After both transactions finished and the tab closed, only the eleven-line observer guard was applied to that instrumented app. Storage, delivery, instrumentation, origin and saved revisions were preserved. With the chooser still open, the natural revision's 2,050 files and validation completed in 395.9 ms; switching back verified the landmark revision's 2,062 files in 407 ms. Each selected title was correct and flight remained ready/disarmed. Settings → Controls → Back → Escape returned paused. Deliberate Arm resumed physics and Pause worked afterward.

The machine-readable receipt records exact source, derivative hashes, extracted load events and SHA-256 hashes of the preserved raw logs/screenshot. These sequential observations support suppressing unnecessary covered presentation; they do not establish a statistically controlled speedup, general storage throughput, physical-device FPS, a post-fix installation measurement or final packaged release qualification. The old cursor storage was deliberately retained to separate this change from #1432's batching correction. No browser/player storage was cleared.
