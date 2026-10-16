# Repairing an exact retained world revision

## Reproduced failure

At main `87c03ccded5ee836d77aefb8949472feae218e36`, the store's active project/assets and retained exact revision could diverge after a verified reinstall. `install` rewrote the active copy but skipped an already-known retained hash; `get(id, { sha256 })` prefers that retained copy. Therefore a missing retained file still failed verification after a successful reinstall of the exact original bytes.

The functional reproduction installs two real immutable Urban descriptors, removes one asset only from the first retained record in an isolated in-memory database, closes/reopens its connection, and retries the original verified download. The baseline fails at the post-install exact load with `Installed regional file is missing`. The negative output is preserved externally as `revision-repair-baseline-87c03ccd.txt`. It models damaged storage; it does not induce browser eviction or touch player data.

## Correction

The existing atomic transaction now refreshes a known retained copy from the already-verified incoming project/assets, preserving its original installation metadata. The active pointer, active assets, retained assets and generation still commit or abort together. The existing expected-generation guard remains unchanged. Other revisions and the separate saved-location store are untouched.

Retained byte accounting replaces the previous copy's charge instead of adding a second copy, and rejects a replacement exceeding the unchanged 256 MiB limit. Revision-count and legacy active-record retention guards remain in place. No schema/version migration, automatic eviction, background download, new repair button, physics or package budget change is included.

## Evidence

`node authoring/fpv-worlds/regions/verify-revision-repair.mjs` passes six functional groups:

1. Missing retained file fails closed after a connection reopen, while the second version loads.
2. A corrupted repair download leaves generation and both versions unchanged.
3. Valid same-hash reinstall restores exact cache-only loading, without an extra revision or changed original installation date; saved places and previously captured flight bytes remain intact.
4. Stale generation and an aborted transaction cannot partially repair or replace either version.
5. A valid retry remains verifiable after closing/reopening the connection.
6. Synthetic accounting reports two 90 MiB entries, then replaces one with 90 MiB successfully. A 200 MiB replacement plus the other 90 MiB is rejected without a generation/list change. Each actual Blob contains one byte: this proves budget accounting, not real quota behavior.

Existing `game/test/fpv-world-content.test.mjs` (12 cases) and `verify-revision-removal.mjs` (four cases) also pass. All tests use isolated IndexedDB instances. Source/package and native evidence must be reported separately; no actual browser restart, full-network-offline, eviction or physical-device claim follows from these checks.

## Remaining integrated qualification gates

Audit against `fpv-reviewed-delivery-plan.md` and `fpv-large-worlds-delivery-plan.md`:

- **Actual browser process restart:** still open. Page reload, connection reopen and cached origin-unavailable launch are bounded evidence, not process restart. A future controlled browser lifecycle must preserve the exact package, origin, installed revisions and places, then verify normal disarmed launch without reinstalling or clearing storage.
- **Network-wide offline:** still open. Existing stopped-origin checks preserve caches and exercise normal launch, but do not disable all network access. Record that distinction and qualify runtime plus installed scenery separately.
- **Actual quota/eviction:** still open. Isolated modeled failures verify transaction safety and guidance; they do not reproduce browser eviction. Do not fill or evict the player's real storage to obtain a receipt.
- **Actual authored-region elapsed endurance:** a fresh visible-commanded run is separate from the preserved invalid strict-focus 1,036-second segment and successful ten-second smoke. Segments must not be joined. The earlier two-hour synthetic corridor result is not authored Urban coverage.
- **Physical devices/controllers, broad same-device performance and deployed launch:** remain separate from desktop fixtures, archive admission and merges.
- **D6:** the deferred broader unit/regression inventory remains open. This is a focused reproduced-recovery check, not completion of that sweep or the roadmap.

The next player-facing recovery increment may offer an explicit verified re-download of one damaged saved revision without first deleting it. That interface is not implemented here; this change first fixes the underlying reinstall contract it must rely on.
