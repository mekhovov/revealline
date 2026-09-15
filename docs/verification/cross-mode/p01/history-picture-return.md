# Picture preparation after browser history

This is a source correction within P01. It does not qualify a release or close the phase. The [v0.57.2 public review](public-v0572.md) retains the original failure and native evidence.

After selecting an unstarted mission, visiting Release Explorer and using browser Back, v0.57.2 reported that the profile writer no longer owned picture storage and incorrectly asked the player to restore original media. The historical saved flight and original pins remained intact. The selected, unstarted mission was a different picture owner from that saved flight.

`pagehide` correctly releases the writer permanently. Previously, an explicit picture Start was cancelled, while a speculative prewarm merely lost its status observer. The surviving owner could reach its protected release-art commit after the lease was gone, and its same-owner error handler could overwrite the returned page's HUD.

The correction aborts pending picture work and retires its prewarm lease on pagehide. Both late success and failure require the exact current lease. A persisted return keeps decoded artwork and immutable pins, remains paused, and does not reacquire the writer. Continue verifies and adopts the existing saved flight read-only; Resume remains explicit.

Fresh choices continue through exact release-art resolution. Existing asset/presentation history can be reused without downloading or writing. Missing history is refused before the next download with a specific session-only explanation and visible Export game data / Reload saved profile actions. The existing commit guard remains authoritative if ownership changes during preparation. There is no automatic legacy fallback or reload. A completed append remains durable after cancellation; the cancelled attempt cannot adopt it late.

The new `game/test/history-picture-host.test.mjs` uses the real app, picture resolver, writer lease and finite IndexedDB model with a bounded one-pixel release-art fixture. It covers:

- Speculative transport that ignores abort and later rejects; the cancelled owner cannot change HUD, run or storage.
- Unfinished new-art recovery without another download, automatic navigation, legacy selection or writer reacquisition; both recovery actions use actual handlers.
- Retained release-art reuse and normal Main menu → Continue → explicit Resume, including exported run ID, checkpoint and immutable pins, without new writes.
- Cancellation after durable original storage but during selected-picture display decode; explicit Start reuses the same pin and retries only decoding.

The first decode fixture paused the earlier pre-commit validation step, so it could not establish pinned display recovery. That failed fixture run is retained separately. The corrected fixture waits for the actual original commit before holding display decode. No runtime timeout or readiness assertion was weakened.

Related focused checks retain missing-original refusal, existing legacy compatibility, committed-history cancellation, CAS conflicts, single-writer behavior and history-cache music handling. Exact results belong to the accompanying source receipt. The corrected native Back/Continue/Resume sample below is complete. Recovery-button geometry at portrait/short landscape, later full gates and immutable public verification remain required. Modeled lifecycle events and downloads do not prove physical devices, browser cache admission or a file saved by the OS.

## Native history return

The [native review](history-picture-return/native-review.json) and [byte-verified evidence archive](history-picture-return/native-evidence.zip) preserve both local attempts. No production game bytes or player state were injected. A cache-only HTTP wrapper served the actual publisher-generated Explorer at the development link’s existing `/releases/` route; this is not a public Explorer qualification.

The first attempt used the ordinary source server’s `no-store` headers. Chrome reported those headers as back/forward-cache rejection reasons and performed a fresh load. The same saved run, checkpoint and pins survived Continue/Resume, but this result does not establish persisted history restoration. Its actual 500×701 viewport and incomplete observer coverage are retained.

The separately authorized continuation served the same source bytes with public-style cache headers. Its first CDP connection stopped replying before flight; four queued commands refused at target lookup without sending input. One explicit reconnect reused the same owned target/profile with a healthy, bounded observer. Chrome then recorded trusted `pagehide` and `pageshow` with `persisted: true` and the same document time origin at 1280×800.

Normal Explorer → Back → Continue remained paused at checkpoint `76616d3c99da865b`, tick 729. The original pins and both image blobs remained exact; all eight IndexedDB store digests, including the managed ledger, stayed unchanged. No localStorage writes were observed after return. IndexedDB comparisons prove endpoint equality, not a complete transaction trace; focused tests separately verify writer and commit ownership.

Only the native Resume click restarted play. The timer advanced from 2:53 to 2:52, and ordinary movement subsequently captured 1.5% for 340 points. The returned tab remained session-only and did not replace persistent progress. No missing-picture error or runtime exception was observed. Unresolved new-art recovery remains covered by the focused host tests, without a native geometry claim.

Both owned browsers and servers were closed, their ports refused connections, and all 99 source pins remained unchanged. After successful deliberate browser closure, the reconnect observer’s socket-close diagnostic attempted to write to its already closed log descriptor; the shutdown-only `EBADF` and earlier connection refusals remain disclosed. All decisive observations precede closure. The evidence is below 2 MiB before compression, excluding profiles. This source sample does not qualify the historical public release, physical devices or the entire P01 phase.

The [original source-check receipt and history-only patch](history-picture-return/source-originals.zip) are retained with a [byte record](history-picture-return/source-originals-record.json). Focused TAP originals remain beside this record. Later source changes still require exact-source qualification.
