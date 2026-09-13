# v0.29.2 ordinary-capture correction — in progress

**P7.7 remains the active release gate.** This is a candidate preparation record, not a claim of a fixed, frozen or public release. Metadata is 0.29.2. Bounded source-browser and host regressions now pass as recorded below; historical-proof checks pass, while the exact candidate SHA/gates, frozen artifact and offline/public journeys remain pending. No later roadmap phase starts.

## Observed blocker

Frozen v0.29.1 source `90b974bfd733ccb11d74383e154467bd172b31d0` passed six exact-source gates and **2,364 tests**. Its independent rebuild/ZIP/offline inventory also passed. The distribution ZIP SHA-256 is `0f90b09e61cd769eaeac4c57b2a843a0f0650c3f7f74807958e4c95907af3385`; the original source, tag and artifact remain unchanged.

The actual frozen browser's ordinary initial **Down** route in First Light R4 reached its first capture (about 51.4% in the owner's state inspection), then threw **Classic event horizon bound exceeded** from `classic-step.mjs:397`, before the next HUD/paint update. A separate browser with its frozen server stopped reproduced the same exception. Successful title startup and saved-flight restoration remain valid observations; they do not make the full offline flight a pass.

Retained console evidence:

- `.cache/round39/browser/capture-hud-console.json`: local frozen route, error at `2026-09-13T04:39:37.510Z`.
- `.cache/round39/browser/offline-capture-console.json`: independent stopped-server route, error at `2026-09-13T04:41:23.252Z`.

The earlier v0.29 mutable-entry failure is a separate issue. Public network bytes matched, but a previously visited browser did not finish startup. Older cached completion remains an inference because resource/cache provenance was not inspected. The controlled stale-app HTTP fixture separately proved visible missing-readiness recovery. The immutable-entry implementation remains the delivery approach; it cannot substitute for successful simulation/flight checks.

## Passed bounded source checks

The actual source browser completed the initial Down cut in First Light R4 and kept the simulation running for about 20 seconds. After Pause, the HUD/paint showed **51.4% revealed, 12,240 points, three lives and 2:10 remaining**, with **Paused** and the focused Resume action. The owner's browser error/warning query returned `[]`. Evidence: `.cache/round39/browser/source-capture-repaired.txt` and `.png`. This is source-browser evidence for the reported route, not a frozen or stopped-server v0.29.2 pass.

Both actual-host regression cases pass: **Immediate** and **Grid + buffer** run the first Down cut through modeled 60 Hz/batched fixed steps, continue another 60 frames, then pause and verify the saved replay. The host exercises the actual app/core/recorder; browser/frame/input boundaries are modeled. Evidence: `.cache/round39/capture-host-regression-attempt-2.log` (**2/2 passed**).

The separate immediate-pause presentation check now passes with the affected suite (**6/6**): Pause refreshes its label and hides touch controls before another animation frame, while the authoritative checkpoint stays unchanged. The same regression against the prior source failed with `running` instead of `paused`; that failure is retained in `.cache/round39/pause-regression-before-fix.log`, with current success in `.cache/round39/pause-presentation-test.log`.

The final repair defers recovery until a repeated zero-time penetration in unchanged geometry, preserving historical simultaneous capture, erosion and failure processing first. It places the actor in the nearest legal domain footprint with deterministic ties and continues the complete remaining tick. It adds no saved state, changes no authored recipe and does not raise the event guard or skip simulation time. Pause also refreshes its presentation synchronously.

The final three-file core change passed **116 affected tests, including seven new regressions**, and the separate 18-route Classic Lab verification. Existing R2/R3/R4 suites preserve 36 exact wins and four R3 impact demonstrations: **54 historical winning routes** in total. The prior frozen core still reproduces both expected first-cut crashes; its due-erosion control passes in historical order. Final host regressions also pass **2/2** after this timing hardening (`.cache/round39/capture-host-deferred-recovery.log`). The source-browser screenshot above predates the final timing hardening; frozen-browser confirmation remains required.

These bounded passes do not close exact-source release gates, frozen first-capture/continued-play and offline checks, or public entry/migration/delivery. The earlier v0.29.1 failures above remain part of the record.

## Required correction and acceptance

1. Reproduce the ordinary first-cut failure through legal inputs; diagnose and repair the bounded event processing without skipping the guard, silently abandoning simulation time or patching the run to bypass the contact.
2. Verify the first capture and subsequent fixed ticks, including both supported turning policies, affected collision/terrain cases and historical replay results. Record the actual regression scope and remaining limits when the core change is ready.
3. Run all six gates against a newly committed exact source; freeze a new v0.29.2 only on success and independently verify source/artifacts/offline inventory and prior-version preservation.
4. Repeat ordinary first capture and continued flight in the actual frozen browser online and with the server stopped. Verify console, coverage/HUD/paint, explicit pause/resume and saved continuation. Startup, restoration, capture and later play each need their own observed result.
5. Complete fresh/previously visited public entry, normal root-worker migration, canonical offline preparation, reviewed PR/Pages and full public-byte plus actual browser checks before promotion.

No old release is overwritten. No cache/profile deletion, forced takeover, changed proof oracle or hidden error is an acceptable shortcut. Player controls remain authored by their edition; R4 still has no manual Scan, Supply or Boost. Root aliases must continue to select one complete immutable graph.

Physical-device support, direct-file browser behavior, human enjoyment, P3 binary-media restoration, Tactical demonstrations, P5 authoring and full P6 production remain separate unfinished work. See the [v0.29.1 evidence](../round-38/v0291-entry.md), [roadmap](../../implementation-roadmap.md) and [delivery workflow](../../feature-delivery-workflow.md).
