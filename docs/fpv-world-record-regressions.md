# World recording archive and storage regressions

This D6 increment adds automated checks around recording backups and local recording storage. Production runtime, formats, physics, scoring, package/file limits and player data are unchanged.

## Existing evidence and the gap

The reviewed legacy Academy notebook tests cover verified attempts and rewards. World content tests cover imported world-pack identity and install rollback. The momentum-contact archive producer checks a checksummed export and corruption, while the ground-motion rehearsal replays retained examples. Those are useful but do not provide a focused, routinely selected regression suite for the World recording archive and its separate IndexedDB record/session stores.

The new archive suite runs in the existing **recordings** phase. The storage suite runs in **local-ux**, which already installs pinned `fake-indexeddb` 6.2.5. Existing phase entries remain unchanged. No dependency or workflow change is needed.

## Completed coverage

- **Trust and compatibility:** v1 import and current v2/v3 checksummed transport retain course/proof/appearance/dependency data, including invalid or unavailable raw records. Every imported verification flag resets to `missing-dependency`. A published, unchanged `beginner-01` self-level demonstration replays to its actual accepted completion after export/import; no lesson commands or progress are generated. A genuine legacy proof retains its appearance in v3.
- **Independent integrity boundaries:** transport changes fail the SHA-256 check; course changes fail recording identity. Even a self-consistent repackaged archive cannot make a proof replay against a different course revision.
- **Bounded input:** invalid versions, part indices, record metadata, excessive selection/part counts, oversized archive/record data, deep values and accessors fail without executing user getters. Empty archives, multipart order, duplicate records and independent part import remain supported.
- **Storage continuity:** duplicate and concurrent saves retain one identity, pins and unrelated records. Pinned removal aborts until explicit unpin. Returned snapshots cannot mutate stored data. Two API connections and a reopened connection observe retained recordings and session values.
- **Atomic refusal and recovery:** the unchanged 512-record limit rejects a new identity without altering prior data, while replacing an existing identity and freeing capacity still work. A controlled abort after queuing a real IndexedDB put rolls back the replacement, preserves unrelated recordings/session, and permits a successful retry. Invalid/oversized writes also retain prior data.

Storage tests use a fresh in-memory database per fixture. Their explicitly opaque raw objects exercise storage boundaries and claim no valid flight or lesson completion. The failure hook injects an abort; `fake-indexeddb` supplies actual transaction/rollback semantics. No browser or user database is opened.

## Verification and remaining gates

Local focused verification: **16 tests passed**, zero failed/skipped/cancelled/todo; lint and repository formatting pass. The production phase selector and exact-main tree check confirm both new files are selected and existing phase paths remain present. The full industrial runner is a cloud gate: the small external preparation intentionally omits unrelated suites. An attempted whole-runner local check is retained as incomplete fixture evidence, not counted as a passing full suite.

This closes a bounded automated coverage gap. Full D6/release qualification, all archived historical proof models, aggregate byte-capacity saturation, real-browser quota/eviction/failure behavior, application restart, network-wide offline operation, physical devices/controllers and actual elapsed endurance remain separate. It makes no new native-player, public-launch or final-art acceptance claim.
