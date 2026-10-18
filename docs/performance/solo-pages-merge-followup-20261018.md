# Solo fixes for the Pages testing build

The user authorized fixing and merging [PR #1544](https://github.com/mekhovov/revealline/pull/1544) on 18 October 2026, prioritizing the published HTTPS game for iPhone 17 Pro Safari and Steam Deck OLED Chrome testing. Main `ce98e93743c0eb2d393d1d24bcc907d728c94951` was incorporated by merge `cb218aa1025590cb83e4d87ba205ffe3af0f7041`, preserving the existing performance history and incoming FPV Workbench changes. The separate unfinished FPV checkout remains untouched.

## Retained failures and corrections

[Production run 39085326291](https://github.com/mekhovov/revealline/actions/runs/39085326291) at `86fd6d0e277b10ac307b15f3f14c267bb4e6f9b0` passed all 624 prerequisite cases, then failed three Replay Theater cases in its complete 118-file gate: 1,745/1,748 passed. Build did not run; no production package exists for that attempt. The cases failed after approximately 11, 10 and 178 milliseconds. A controlled reproduction using the real replay verifier shows that the test helper's 150 immediate callbacks can finish before asynchronous verification settles; the exact pending operation in the remote failures was not observed. The fixture now uses the existing monotonic five-second `waitFor` helper, preserving every public predicate and assertion. The controlled delayed-verification reproduction fails the old helper and passes the new helper against the same real replay. The complete corrected file passes 11/11.

[Focused run 39085326289](https://github.com/mekhovov/revealline/actions/runs/39085326289) at that same source failed Countercurrent at its unchanged 600,000 ms command deadline. The receipt correctly preserves `timedOut: true`, `timeoutReason: command-deadline` and aggregate exit 124 even though Node catches termination and returns status 1. A local source CPU profile identifies substantial avoidable image preparation: `inspectImageDataUrl` accounts for 76.566 seconds of sampled self time, the caller `imageHeader` for 27.950 seconds and base64 validation for 11.217 seconds. These observations do not attribute every earlier timeout or browser hitch.

Two owners already hold the original image bytes but converted them to binary strings and base64 URLs before immediately decoding them back to bytes. `media-still.mjs` and `media-store.mjs` now call the existing `inspectImageBytes` validator directly. The previous data-URL validator delegates to that same implementation. MIME, full static-container validation, dimensions, size bounds, original SHA-256, browser decoding, cancellation, ownership and durable-storage checks remain intact. The new controls disable both base64 APIs, preserve original PNG/JPEG/WebP bytes and verify that corrupt stored bytes still fail before allocating a decoder.

The same focused run's second shard subsequently failed three other commands at their existing 600,000 ms limits: `couch-installed-chapters`, `fracture-chapter-host` and `mode-return-host`. `mission-library-solo-host` also retained six failures at its existing five-second waits. These old-source failures require inspection and a complete successor gate; the image fix is not evidence that every timeout is resolved. The 547,552-byte shard log has SHA-256 `3a98dd5d72e0c5ecdd0ae42805089de97baf548f5969d435b4648167c7604f7c`.

The focused command runner also rejects delays above the signed 32-bit timer maximum before spawning a child. Node converts an overflowing delay to one millisecond; accepting unsigned 32-bit values was therefore incorrect. Existing command budgets are unchanged. [Node timer contract](https://nodejs.org/docs/latest-v20.x/api/timers.html#settimeoutcallback-delay-args).

## Local evidence and limits

Media, Countercurrent and focused-runner checks use Node 20.19.5 on the integrated worktree; Replay Theater uses Node 22.22.2. Focused CI uses Node 20.19.6 and the failed production gate used Node 22.13.1. These are source checks rather than replacements for the successor CI gate.

| Complete check                                     | Result                                                          |
| -------------------------------------------------- | --------------------------------------------------------------- |
| Five image/media/header files                      | 62/62 passed; both old-flow negative controls fail as expected  |
| Countercurrent host file after byte-validation fix | 4/4 passed, 186.015 seconds, original 600-second outer deadline |
| Replay Theater display host                        | 11/11 passed                                                    |
| Focused runner                                     | 54/54 passed                                                    |
| Changed code lint and formatting                   | Passed                                                          |

The Countercurrent profile before the fix passed 4/4 in 309.87 seconds. Its profiler timer was serviced 1.535 seconds late during busy JavaScript, yielding a 301.535-second sample rather than a strict 300-second capture. The retained 17,007,818-byte profile has SHA-256 `7f16b37ee2e1a8ab15098d05d9d9a00ab77572875c8f54a2f8c4ba950ffc2927`. The later unprofiled run is not a matched performance comparison. Neither establishes native-browser speedup.

The corrected complete Countercurrent run retained stable hashes of all loaded source, an unchanged test file, and at least 1,852,178,432 free bytes. Its 1,289-byte TAP has SHA-256 `e51ab9de5a3e4c3b6a15aa73843e6f9d482e74e4b7e166361904805b00430137`. Local receipts are under `.cache/solo-followup/countercurrent-binary-inspection/`, `countercurrent-source-cpu-cb218-v1/` and `replay-theater-wait-86fd/`; the focused-runner TAP is `focused-timer-signed-range-20261018.tap` in that same parent directory. These ignored diagnostic files are not production assets.

## Publication and remaining qualification

The checked successor must pass its release-blocking source and production checks before merge. The existing rolling-main Pages workflow then builds and deploys the exact merge revision. Verify both public `main-deployment.json` and `game/build-info.json` before reporting it ready for device testing. This route does not need a release tag, semantic version bump or frozen-release selector change. [Deployment procedure](../deployment.md).

Publication is not full performance qualification. Final-source native timing, diagnostics overhead, sustained resource behavior, the unresolved native terminal HUD cost, remaining recovery/raster/audio scenarios and physical iPhone/Deck tests remain open in the [follow-up plan](solo-performance-followup-plan.md). Earlier failed or incomplete observations remain failures. The prior successful versioned package and evidence remain available for rollback.
