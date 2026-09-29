# Remaining demo qualification work

Read-only review of `5f2d442e08833f535e8249f3e7b4fa6351fcf17c` on 29 September 2026. This continuation changes only qualification documentation and evidence, as required by the finite observation handoff. The findings below are follow-up work, not implemented fixes or reproduced browser failures.

## Bound scene loading

`game/demo-catalog.mjs:112` and `:173` await catalogue and replay fetches with a cancellation signal but no deadline. `game/demo-director.mjs:93` awaits preparation indefinitely. A request that neither succeeds nor rejects can therefore leave unattended playback in loading indefinitely; the bot planning watchdog covers a different operation.

A future scoped correction should impose a bounded preparation deadline, abort the request, release any adapter that arrives after cancellation, and use the existing failure rotation. It must preserve explicit Pause/Next/close generations and avoid starting music. Test a permanently pending request with a controlled clock, a late success after timeout, user cancellation and successful fallback. The current cancellation test releases its deferred fetch before observing rejection and does not cover a permanently pending source.

## Exercise the byte limit directly

The library's 32 MiB check and eviction loop exist in `game/demo-library.mjs:169–179`. Current count-eviction tests insert thirteen small recordings, then assert the result is below the byte cap; that does not force byte-based eviction. Add valid near-limit recordings whose combined serialized UTF-8 size exceeds the limit, and a single oversized item. Verify the newest valid entry survives, oldest entries are evicted atomically, an oversized item does not change prior bytes, and concurrent writers preserve the same bound. This is a coverage gap, not evidence that the existing cap fails.

## Retain incomplete observation checkpoints

The harness enables report download only after stopping (`game/test/browser/demo-watch.mjs:743–754`), while pagehide releases its resources (`:769–775`). The lost browser attachment prevented collection of the complete in-memory trace. A future harness revision should expose bounded, explicitly incomplete checkpoints during observation, kept separate from the game's saves and profiles. It should include elapsed time, diagnostics, samples and the starting inventory while marking terminal source/storage checks as unavailable until actually collected. Do not infer the cause of the lost tab from this code review.

The interrupted run remains preserved separately. No source, harness, game storage or browser state was changed by this review, and no new observation was started.
