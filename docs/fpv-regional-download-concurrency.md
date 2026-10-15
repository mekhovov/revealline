# Bounded regional download concurrency — 15 October 2026

Regional installations with thousands of small files previously waited for each request
and hash check before requesting the next file. The downloader now uses at most four
payload workers after both manifests and their exact inventory have verified. Descriptor
and manifest acquisition remain ordered. Credentials stay omitted and redirects rejected.
Each file retains its pinned byte limit and SHA-256 check; the complete 64 MiB delivery
limit is unchanged. A failed file aborts peer requests, waits for them to settle, and rejects
before the existing atomic installation. Cancellation cannot emit progress after rejection.
Stored inventory order is deterministic even when responses finish out of order.

## Verification

- `node authoring/fpv-worlds/regions/verify-download-concurrency.mjs`: five functional
  groups pass using compiled terrain, complete paired manifests and deliberately staggered
  streams. Sixteen payloads reach four concurrent requests, all exact bytes and paths are
  retained, progress is monotonic, mismatched pairs request no payload, and corruption,
  mid-flight cancellation and already-aborted input settle without later progress.
- Existing sparse scenery verification: all seven scenarios pass, including strict v1,
  explicit sparse v2, cancellation, missing payload rejection, and real shared flight
  (2,200 ticks, four cell crossings, zero scenery requests for empty cells).
- Complete frozen Canyon expanse bundle: all 2,051 responses and 2,050 payload files
  verified through this production downloader. Payload total 47,646,152 bytes; descriptor
  329,372 bytes, SHA-256
  `d2c3dce6c39227e85a10256fb3d1082fec2a6c7a47f6347fd664e2840eb57003`.
  Four filesystem-backed reads were in flight at most. The 49.69 s local reading/hash
  observation is not an internet download benchmark or a before/after speed claim.
- Native Chrome 155 on Mac16,7/macOS 26.7.1: production downloader and real IndexedDB
  installed an isolated 329,454-byte compiled fixture. Corrupt and cancelled replacements
  rejected; generation 1 and the exact saved revision remained unchanged and readable.
  The review used a dedicated database, with no player data deletion. Console errors and
  warnings were empty. Evidence: `concurrent-download-native-receipt-20261015.json`,
  `concurrent-download-native-proof-20261015.png`, and
  `concurrent-canyon-full-receipt-20261015.json` in the external `fpv-temp` evidence folder.
- Scoped syntax, formatting, lint and whitespace checks pass.

## Remaining qualification

No UI, flight model, source package, regional limits or saved-revision format changes.
Full candidate packaging, exact packaged browser/offline journeys and public deployment
are separate pending checks. Network/device-specific throughput and peak process-memory
measurements are not claimed by these functional observations. The original sequential
manifest safety boundary and all-or-nothing commit remain in place.
