# Gallery celebration clock: scoped source verification

The current-source gallery clock fix passes **38/38 affected tests**, including four new regressions. The first new regression reproduced the strict `Celebration dt must be finite and nonnegative` exception before the production change and passes afterward. This is source evidence for the next integrated release, not a repair of the preserved v0.17.1 artifact or a new browser-animation certification.

The [frozen browser report](../round-27-1/frozen-browser.md) retains its single timestamped gallery exception. Its two console captures repeat that event; they do not establish two failures. The log did not record frame timestamps. The regression establishes a concrete mechanism consistent with that stack, without claiming those were the exact frozen callback values.

## Local clock change

Only the per-invocation frame closure in [library-panel.mjs](../../../game/ui/library-panel.mjs) changed. Each Play celebration begins with no timestamp baseline. Its first finite animation-frame timestamp draws with zero delta; later finite timestamps advance by a value clamped to 0–0.1 seconds. The baseline retains the greatest finite timestamp seen, so an equal or backward sample cannot replay an interval when time catches up. Nonfinite injected samples draw with zero and leave that baseline unchanged.

Delivered hidden callbacks maintain the clock while the renderer receives the existing `celebrationPaused` flag. A suspended callback stream still uses the existing 0.1-second catch-up cap on return; this change adds no precise wall-time visibility accounting. Restart creates a fresh clock. Existing picture/generation/dialog guards, cancellation, reduced-effects lookup and active-only rescheduling remain in place.

The strict [advanceCelebration validator](../../../game/ui/celebration.mjs) is byte-identical to frozen v0.17.1. No arbitrary renderer exception is swallowed, and no gameplay, rewards, storage, assets or portable formats changed. The [accepted design](../../../.cache/round-28/gallery-clock-plan.md) explains the animation-frame timestamp boundary and its specification references.

## Regression evidence

The [real panel harness](../../../game/test/gallery-reduced-effects.test.mjs) now accepts explicit queued frame timestamps and removes each delivered callback. It still runs the actual panel handler, BoardPainter's celebration start/status, and strict `advanceCelebration`; only DOM/image/canvas work is adapted.

- **First frame behind the sampled startup clock:** supplying frame time zero previously threw. After the fix, that first draw advances zero, the next known 16 ms advances exactly 0.016 seconds, and continued callbacks reach the completed picture with no frame left scheduled.
- **Clock boundaries:** equal/backward samples grant no time; returning to the prior maximum does not double-count. NaN/Infinity injections do not poison subsequent valid progression, and a long gap contributes at most 0.1 seconds. These injected values are defensive cases, not observed browser timestamps.
- **Restart and close:** retained cancelled callbacks neither paint nor reschedule; a restarted invocation establishes its own zero-delta baseline.
- **Visibility and reduced effects:** a delivered hidden interval contributes no finale time on visible return. Existing reduced-mode tests now also confirm immediate completion on the initial zero delta. Library data remains unchanged in each case.

The preserved [before-fix TAP](../../../.cache/round-28/gallery-clock/before-fix.tap) has the single selected regression failing with the actual strict-validator stack. The [after-fix single-case TAP](../../../.cache/round-28/gallery-clock/after-fix-first-frame.tap) passes. The final [affected-suite TAP](../../../.cache/round-28/gallery-clock/affected-tests.tap) contains **38 passes, zero failures/skips/cancellations/todos**, across gallery reduced-effects, gallery focus/loading, and reward/finale tests. Four are new unique tests; existing cases are not counted again as new tests.

```sh
mise exec node@22.22.2 -- node --test game/test/gallery-reduced-effects.test.mjs game/test/gallery-focus.test.mjs game/test/rewards.test.mjs
mise exec node@22.22.2 -- npx eslint game/ui/library-panel.mjs game/test/gallery-reduced-effects.test.mjs
mise exec node@22.22.2 -- npx prettier --check game/ui/library-panel.mjs game/test/gallery-reduced-effects.test.mjs
```

All final commands and the scoped diff-whitespace check exited zero. No broad source suite, historical proof regeneration or browser operation was performed for this report. Root's visible four-theme celebration rechecks and fresh console observations remain separate acceptance evidence.

## Exact inputs

| Input or retained result            | SHA-256                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| Pre-fix panel                       | `709e9218d4089027a7ca874c990cfcf5a899adf0cf775fb40813fe9dee99a587` |
| Fixed panel                         | `2bef5afb93d5034b37143286321075cc5a3fa9d7c406c64f5f67c929f74c1eec` |
| Final gallery reduced-effects tests | `3b79806213a962f5c7b6d042bdaac382afd32049ace1a63a3a43f633cdca2756` |
| Unchanged strict finale module      | `d242a42e9aa595adc00a6b85b4f2e3ead6f3a5a94e8ddc230b131b1c97827232` |
| Before-fix TAP                      | `b518fb6127b5ea13032891d9905874f92e7aeecc7600a10eea566109fac1a917` |
| After-fix single-case TAP           | `8876f9ac42e7eb10fa951e4c17560059d03d3e51522bb6f692d1ca6e8aea984a` |
| Final affected-suite TAP            | `c6e8de7a390f6f1676bf106accfe4ea5cd9aa305a8ec5cee5ebdd0b48df765ee` |
