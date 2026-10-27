# Bounded lifecycle evidence storage

This is a storage correction for a separately declared long lifecycle diagnostic.
It does not change the game, raw evidence kind, scenario timing, numerical gates,
browser observer, resource rules or historical failed results. No new cohort is
released by these changes.

## Explicit admission and unchanged readers

A recipe must declare `evidenceStorage: "snapshot-chunks-v1"`, remain `lifecycle`,
and contain an explicitly declared repeat of at least 30 minutes. The qualifier
also requires exactly one `--snapshot-chunks` flag. Either declaration alone, an
unknown mode or a performance/recovery kind is rejected. The sustained adapter
requires the helper to appear among its hash-verified frozen inputs before
enabling this mode.

The consumer inventory is:

| Consumer                                                                                   | Effect                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `qualify-solo-runtime.mjs`                                                                 | Its in-memory report and final gate/resource/replay calculations are unchanged. Only explicit chunk mode delegates saving to the new writer.                                                                 |
| `solo-remote-sustained.mjs`                                                                | Its explicitly admitted chunk mode hydrates before calling the existing timing/lifecycle/recording assessments. Other modes retain the existing inline reader.                                               |
| `run-solo-remote-correctness.mjs`                                                          | Default first-30 reports remain inline. Sustained extension rows use their adapter; final summaries consume assessed rows. Recursive inventory includes every chunk under the existing byte/file-count caps. |
| `solo-remote-auxiliary.mjs`, `solo-remote-supplemental.mjs`, `solo-remote-cpu-profile.mjs` | Existing frozen recipes have no storage declaration, so reports remain inline and these readers are unchanged.                                                                                               |
| `qualify-solo-diagnostics.mjs`, `solo-diagnostics-analysis.mjs`                            | These analyze the separate diagnostics observer format, not the long lifecycle qualifier report. Unchanged.                                                                                                  |
| Demo, offline, MP3-worker and native-raster observers/adapters                             | These own other report formats. Unchanged.                                                                                                                                                                   |
| Replay export and native replay verification                                               | Consume the ordinary replay recording, not the report snapshot storage. Unchanged.                                                                                                                           |

No generic report-regeneration consumer was found outside these entry points.
Manual analysis of a new chunked report must import
`readQualificationSnapshotReport()` and work with the hydrated object. The
storage index alone is not a complete inline report. Do not serialize an extra
hydrated copy inside the bounded row directory.

## Format and reservations

Each completed snapshot is frozen deeply, compactly encoded once and written to
an exclusive temporary file. Its full readback is hash checked before publication
under a sequential immutable filename. A hard-link publication cannot overwrite
an existing chunk. Only the small index is atomically replaced. Its references
contain the exact filename, size and SHA-256 of every snapshot in original order.
All arrays and fields survive ordinary JSON normalization. The reader removes
storage metadata and returns the original report value shape.

The reader rejects symlinks and aliases, oversized files, invalid UTF-8/JSON,
changed bytes, duplicate/reordered/path-escaping references, count mismatches,
missing/extra chunks and unfinished chunk/index files. A failed save is terminal
for that writer and retains its files for diagnosis; it does not silently retry
or present a stale index as complete.

| Reservation                                         |   Bound |
| --------------------------------------------------- | ------: |
| Writer, including transient logical copies          |  96 MiB |
| One index                                           |   4 MiB |
| One snapshot                                        |   1 MiB |
| Snapshot count                                      |     512 |
| Ordinary final replay in chunk mode                 |  16 MiB |
| Existing command stdout/stderr cap                  |   4 MiB |
| Remaining row allowance for receipts/other evidence |  12 MiB |
| Existing outer row cap                              | 128 MiB |

The writer checks cumulative bytes before each publication. These limits cannot
be increased through helper options. They bound storage; they do not promise
that every possible browser payload will fit. An exceeded limit fails visibly,
retaining the available evidence. No samples are truncated to fit a limit.

Memory profiling finishes assigning `row.memory` before the first snapshot save.
Subsequent resource and memory summaries read these frozen snapshots and create
new summaries; terminal cleanup appends a fresh partial snapshot. Final gate
calculations likewise read existing snapshots. Tests cover this ownership
boundary. Root-level action/failure/finalization metadata remains mutable and is
retained in the index on each successful save.

## Validation and retained evidence

The original Chromium 3 candidate report from run `38992974807` is 71,794,734 bytes
with 136 snapshots and SHA-256
`725422982a105dc2d5b09c30fb54a7334fb0d2bf67de46ad2d666d916fa61cd7`.
Replaying all its snapshots through the writer produced 136 snapshot writes and
138 small index writes. Peak logical file bytes were 33,166,452, below the 96 MiB
writer reservation. Every normalized JSON value matched on readback; both
original and hydrated SHA-256 were
`fe7de1e3008a3746439435cd9bb0bc43821f9a3b678d5c5f2b8cf33b2757c609`.
The temporary output was removed after success. The small receipt remains at
`.cache/solo-followup/snapshot-store-review/retained136-roundtrip.json`.

This is a filesystem/serialization test, not new browser, timing or memory
qualification. Focused helper/policy tests cover valid round trips, immutable
chunks, matching scope declarations, terminal summary reads and negative
bounds/hash/path/partial-file cases. Existing declaration-only module closure
remains unchanged because helper imports are dynamic and only used after an
explicit storage declaration.

The prospective route, frozen input hashes, declared release and remote test
still require review before execution. Existing CPU and other active frozen
cohorts retain their original inline reports. The original failed soak and its
recipe remain separately retained.
