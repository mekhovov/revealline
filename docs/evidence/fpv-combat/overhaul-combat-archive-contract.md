# Combat recording archive contract

The v2 live recorder keeps twelve complete one-minute segments and the current partial segment. This memory bound remains independent of durable storage. Historical v1 recordings and AircraftSessionArchive.v1 retain their formats and dispatch.

## Durable recording

`createEncounterArchive` attaches to a v2 session and copies only sealed accepted-command segments. A single background operation owns the write; overlapping captures share that operation. An interrupted write, quota failure, missed segment, or replaced session preserves the previous durable prefix and stops archival without stopping play.

Combat archives reuse the existing IndexedDB transaction/revision/budget implementation through a trusted codec. They have their own database namespace and limits: 32 MiB per archive, 128 MiB total, sixteen archives, and 256 records per archive. Nothing is automatically deleted. These limits are separate from historical aircraft archive storage.

`export()` pauses the current session at an accepted boundary, captures its sealed tail, and adds the final paired physics/encounter recovery and current partial command segment to the exported package. The feed remains available for later flying and recording. `finish()` also persists that final boundary and closes the archive. Cosmetic snapshots remain in normal recovery exports; combat archives retain gameplay, exact definition identity, configuration identity, run identity, and optional validated launch hints.

A Continue operation may seed the new feed with `resumeFrom`, a fully validated original archive packet. Its run, definition/configuration identity, ending accepted tick, command queue and encounter boundary must match the restored live session. The old final boundary is excluded; only sealed chunks are copied, followed by newly sealed live chunks. This preserves a full verification chain after continuing beyond the live twelve-minute ring without storing duplicate final records or relaxing the bounded archive policy. A different run or boundary is rejected before a new archive is opened.

## Verification

The archive has an ordered wrapper chain and retains the original encounter-segment hash chain. These checks detect transport changes; they are not a proof of gameplay. Playback starts from the exact original content/configuration and re-executes every accepted control/command interval through the production session. Verification compares final encounter state and the accepted physical boundary. No rewards are awarded by playback.

Complete exported or finished archives can therefore be played and verified after the live twelve-segment ring has rolled. A missing beginning, middle segment, final paired boundary, changed command sequence, or changed configuration is rejected. The verifier uses references to bounded frame chunks rather than allocating another lifetime frame array.

An interrupted open archive has durable command segments but no complete final paired boundary. It is explicitly incomplete and cannot claim verified results or provide Continue from a fabricated checkpoint. A normal recovery export remains independently usable for Continue even if its command history is truncated.

## Public integration

- `createEncounterArchiveStore({indexedDB})`: bounded begin/append/finish/list/export/import/delete store.
- `createEncounterArchive({session,store?,indexedDB?,name?,id?,launch?,resumeFrom?})`: `capture()`, `export()`, `finish()`, `snapshot()`, `dispose()`.
- `snapshot()`: state, error, durable tick interval, segment count, used bytes, capacity.
- `inspectEncounterArchive(packet)`: validated recovery, definition, summary, packet.
- `createEncounterPlayback(packet,{createSession})`: same playback controls as recovery-file playback.

Implementation tests and browser checks must be reported separately from this contract. In particular, the finite IndexedDB test model does not qualify a specific browser's actual disk/quota behavior.
