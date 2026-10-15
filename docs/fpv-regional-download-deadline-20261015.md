# Regional downloads: progress-aware deadline

The Library previously cancelled every action after 120 seconds, including an
otherwise healthy region download. The verified 8 km Canyon transfer took 144.3
seconds in its remote command-line receipt; that observation does not establish
browser speed, but exposes why a fixed two-minute transfer cutoff is unsuitable.

## Change

- An install may continue while received byte counts increase. Both descriptor
  inspection passes report their chunk activity separately from payload totals. A 120-second period
  without forward byte progress aborts the attempt.
- A separate ten-minute total ceiling stops trickling transfers from running
  indefinitely. This ceiling is not a promise that every network can download a
  64 MiB region within ten minutes.
- Refresh, Fly and removal retain their original two-minute deadline.
- Explicit cancellation, navigation invalidation, bounded four-request concurrency,
  exact hashes and atomic installation remain unchanged. No source or saved-world
  budget is increased.
- Once the atomic storage commit starts, its outcome remains authoritative. Transfer
  timers stop; an existing installation is not discarded or declared cancelled
  because the storage commit completed after navigation.
- Timeout feedback distinguishes a stalled/overlong attempt from player cancellation.

No runtime dependency or module is added. The helper lives in the existing Library
module, preserving package import closure.

## Functional evidence

`node authoring/fpv-worlds/regions/verify-library-deadline.mjs` verifies continued
progress, subsequent stalls, the hard ceiling, unchanged non-install deadlines,
invalid/repeated byte counts, atomic commit ownership, cancellation and cleanup.
It also sends all 39 responses of the exact committed Urban review-r2 inventory
through the production downloader over 195 **virtual** seconds; hashes and inventory
verify successfully. A second case streams both 6,603-byte descriptor reads and all payloads across
430 virtual seconds, matching the UI inspection-plus-install sequence. Virtual
time is deterministic deadline evidence, not browser
elapsed time, network throughput or device performance.

The existing five concurrent-download verification groups pass: four requests
maximum, stable inventory, manifest closure before payload admission, first-failure
cancellation and settlement, and no late progress escaping a cancelled attempt.
Scoped formatting, lint and whitespace checks pass.

Native Library workflow, localized timeout display and exact package qualification
remain pending. The uninterrupted two-hour browser measurement is not disturbed
for this independent change.
