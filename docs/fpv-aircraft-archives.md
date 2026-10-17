# Aircraft session archives

This increment adds persistent archives to the bounded recent clips delivered in
the twelve-aircraft practice release. It does not change historical backends,
recording identities, or the physical trajectory of a flight.

## Player behavior

Aircraft practice starts a local archive after its worker and terrain are ready.
The pause screen lists saved sessions and their durable time range. **Finish current
archive** pauses flight, captures the accepted final segment, and closes the archive.
Resuming continues the flight without silently opening a second archive. Starting
another flight or recovering a checkpoint creates a separate archive.

Players can export, import, verify, or explicitly delete a selected local archive.
Verification runs in a separate worker, reports progress, and can be cancelled.
Cancelling verification never terminates the flight's worker. Recovery checkpoints
and recent clips remain independent of the archive store.

Storage limits are 32 MiB per export/archive, 128 MiB locally, 16 sessions, and
256 segments per archive. Metadata reserves 64 KiB within the export budget.
Nothing is deleted automatically. Quota errors, missing segments, and insufficient
write throughput stop archival and report the durable prefix; they never stop
flying. A tab closed before finalization leaves an explicitly incomplete archive.

## Verification and persistence

`AircraftSessionArchive.v1` manifests and `AircraftArchivePackage.v1` exports retain
unchanged `AdvancedAircraftSegment.v1` payloads. A segment and its updated manifest
and quota counter commit in one IndexedDB transaction. Revision checks reject stale
writers; identical retries are idempotent. Archive IDs are independent of simulation
identity. Imported open archives become interrupted rather than acquiring a live
writer.

The UI keeps one pending segment operation and never queues an entire flight.
A missed cursor stops the archive. Generation tokens distinguish new and restored
workers, including repeated restores at the same tick. Restored recordings can
begin from an earlier retained checkpoint, but are always checkpoint-origin clips.

The verifier checks ordered segment digests, boundary checkpoints, all periodic
hashes, and the final physical state using one simulator. A complete-session result
requires an explicitly ended archive, a fresh origin at tick zero, and a canonical
initial state matching a new simulation. Other successful checks certify only the
retained checkpoint-origin clip. All archives remain unscored. These results certify
recorded simulation physics, not aircraft fidelity or competitive mission results.

## Acceptance evidence

- Storage tests cover actual byte budgets, atomic write failures, stale revisions,
  cancellation, missing/reordered segments, explicit deletion, and import status.
- Runtime tests compare physical trajectories with and without final-tail capture,
  check immutable closed segments, and reject forged canonical starts.
- Real Academy and Regional integrations exercise physics, IndexedDB, ring eviction,
  checkpoint recovery, finalization, verification, and continued flight.
- UI tests cover preparation races, bounded pending writes, quota failure,
  generation changes, cancellation, and English/Ukrainian labels.
- Local browser acceptance captured a 56.10-second World session, finalized it,
  and reported “Complete session physics verified from reset. Unscored.”

Native worker availability, offline package closure, and current source-pinned
numerical/browser reports remain release gates. The first twelve-aircraft release
is independently tracked in `fpv-aircraft-presets.md`; optional endurance challenges
and measured aerodynamic validation are not implied by this archive increment.

## Package measurements

The archive increment adds three explicitly admitted modules. Academy contains
132 runtime files / 11,732,387 bytes and 134 complete source files / 11,772,694
bytes; its installed-core cache is 12,742,006 bytes within the reviewed
12 MiB + 192 KiB cap. Original inputs are 12,916,052 bytes within 12 MiB + 384 KiB.
World contains 191 runtime files / 18,221,003 bytes and 193 source files; its
20 MiB cap is unchanged. Combined native staging is 197 files / 18,602,974 bytes
within its unchanged 32 MiB cap. These measurements include the independent
optional-depletion editor controls, but exclude the later propulsion-evidence UI.
