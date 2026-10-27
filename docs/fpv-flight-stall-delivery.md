# Flight stops after a busy frame — root cause and delivery

## Root cause

The player screenshot showed **Resume**, **Arm / resume**, and radio stick pickup while the drone retained speed. This is a paused session, not sufficient evidence of a permanently blocked renderer.

The investigation reproduced a faulty pause policy: a display or callback execution gap above 250 ms was labelled focus loss even in a visible, focused tab. That path paused flight and froze radio ownership, producing the screenshot's deliberate-resume requirement. A late worker completion had the same pause path. Academy shared the policy, standard controller polling separately emitted Pause on such a gap, and Advanced practice stopped after a worker step lasting more than 250 ms.

The initial regression run failed on these unwanted pauses before the production change. This identifies a reproducible trigger; it does not attribute every historical screenshot or GPU stall to that one trigger.

## Fix

- Worlds and Academy discard missed wall time and accept one fresh 20 ms simulation interval after a delayed display callback. Repeated slow callbacks remain playable rather than continuously hitting a pause threshold.
- A late asynchronous completion retains its committed interval and discards queued scheduling debt. The next display callback samples fresh controls and resumes dispatch, without duplicate intervals or catch-up teleportation.
- Standard controller polling preserves ownership across a foreground delay. Invalid/backwards clocks and actual device/focus loss still invalidate input.
- Advanced practice schedules the next single interval after a slow accepted worker step instead of pausing.
- Automatic next-lesson navigation is cancelled on a timing interruption so a delayed callback cannot unexpectedly launch another lesson.

Actual focus loss, hidden pages, disconnected/invalid inputs, explicit pause/menu actions, terminal outcomes and real worker errors retain their existing behavior. No automatic rearm, radio remapping, profile/schema change or physics-frequency change was introduced.

## Qualification

**37 selected checks passed, zero failed; 233 tests were excluded by the name filter.** Coverage includes all Worlds activities, native/Regional scheduling, stale animation timestamps, 300 ms to five-second gaps, repeated slow callbacks, fresh radio/keyboard/controller input, accepted/rejected worker intervals, pause/hidden/focus ownership, Meteor checkpoint recovery, cached page restoration, input failure and next-lesson countdown cancellation.

The isolated browser preview successfully loaded and launched the rebuilt SIM without console errors. Its idle drone reached an ordinary defeat result after 8.6 accepted seconds; Retry recreated the scene. This is startup/flight smoke evidence, not a long-session or physical-radio acceptance result. The player's active tab and saved controls were not changed by the preview.

Both packages construct within unchanged policies: Academy 145 runtime / 147 source files, **65,696 source-input bytes remaining**; Worlds 208 / 210 files, **488,223 source-input bytes remaining**. Local provenance placeholders do not qualify a published release.

The updated packages are served on localhost:8768 for the player's next refresh. The browser can still render a slow frame under heavy load; this fix removes the unintended permanent pause triggered by that delay. Full catalogue performance runs and a physical-radio combat session remain pending.

## Integration

Child of frozen #1806 at `a7f0986c38206568c6282b77bd5834383494be58`. Four runtime source files and five scoped test files, plus this delivery evidence. No added runtime modules or generated presentation changes. Coordinate integration after #1806 with Releases; existing published parent heads remain frozen.

[Delivery receipt](evidence/fpv-combat/flight-stall-delivery.json) · [Package measurement](evidence/fpv-combat/flight-stall-package-measurement.json) · [Rebuilt scene capture](evidence/fpv-combat/flight-stall-preview.png)
