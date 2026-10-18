# Aircraft archive retention follow-up — 18 October 2026

Status: **P1 open.** The small connection-reopening fix is resilience work, not a diagnosis or proof of durable retention. Do not claim the protected archives remain available or that an authorized deletion completed.

## Observed behavior

The parent task reported these rendered-browser observations; this audit did not independently inspect the browser's native database contents:

- On fresh local origin `localhost:8786`, Home → Fly now → Pause → Workbench → Meteor75 → Use in draft → Test draft → Arm produced `Failed to execute transaction on IDBDatabase: database connection is closing` in archive status. Flight continued and separate recovery checkpoints advanced. Refresh saved sessions also failed with the closing-connection error.
- On the public GitHub Pages SIM, the displayed archive inventory contained 16 sessions. The user authorized removal of exactly 10 test sessions while preserving six others. The attempted deletion of the selected 05:50 test archive reached confirmation, then displayed a closing-connection failure. All 16 cached rows remained visible and there was no successful deletion receipt.
- After reloading to reopen storage and starting a five-second test flight to expose the archive controls, a refreshed inventory showed only the new session labeled `17:50:35`; the preceding 16 rows were absent. No further deletion was attempted. The six requested retained archives have **not** been confirmed preserved or recovered.

This is a retention failure observation. The original connection identity, close event, native store inventory and transaction outcome were not captured. The change from 16 cached rows to one refreshed row does not establish that the app deleted 16 archives, that a browser evicted them, or that the browser reused the same persistent-storage context.

## Source boundaries and focused verification

`optional-practice/civilian-fpv/aircraft-archive.mjs` opens fixed origin-wide database `revealline.fpv.aircraft-archives.v1`, version 1. Its upgrade handler creates missing stores only; it does not clear or drop existing records. `list()` reads all archive manifests without filtering by flight, pilot profile, aircraft or locale.

The deletion implementation validates one selected archive ID and expected revision, deletes that archive's explicitly indexed segment keys and its one manifest, then adjusts the shared budget in the same transaction. There is no delete-all fallback. A native failure while creating the delete transaction occurs before those deletion requests can be queued. However, the old UI awaited both deletion and a following list read before reporting success: a failure of only that read could show the same generic error after the selected deletion committed. The observed error does not identify which stage failed. This ambiguity could affect one selected archive, not explain the other fifteen missing rows.

World creates its archive controls once per mounted host. Changing the draft flight changes the current session reference, not the database owner. Controlled store close happens at host disposal, rejected opening after disposal, or version change. No production `deleteDatabase`, `Clear-Site-Data`, or IndexedDB-enumeration/reset path was found in the repository search; prefixed test-fixture preparation scripts are separate.

The store previously retained its cached connection after a browser-originated `close` event. A finite IndexedDB test reproduced subsequent operations reusing that closed connection. The focused fix invalidates only the affected cached connection, allowing the next operation to reopen. It does not retry an uncertain write, resume a stopped archive automatically, delete data, or claim that reopened data is complete. Explicit store closure remains permanent.

Two new regressions failed before that fix. The archive-store suite then passed 13/13, including durable-prefix preservation after a failed write, reopening on a later operation, ignoring a late close from a replaced connection, and explicit disposal never reopening. These are bounded software tests, not a browser disk/eviction qualification.

The existing [16 October storage-owner audit](fpv-public-storage-owner-audit-20261016.md) documents an earlier public closing-connection error followed by missing saved World/regional inventories after reopening. That prior negative also remains unresolved. The current archive observation adds evidence of recurrence; it does not resolve the original cause.

A separate [finite memory-only transaction experiment](fpv-archive-retention-memory-20261018.json) populated sixteen archives with thirty-two segments. An injected final-budget-write failure rolled back the selected deletion; reopening retained all original manifests and segments exactly. Ten later explicit successful deletions and reopening retained exactly the six other archives and twelve segments. This supports transaction isolation in the modeled implementation; it does not reproduce native disk, eviction, storage-context replacement or the public inventory loss.

## Later non-destructive local observation

A separate source-preview tab on `cf13bcad9a59a387be7c31c9af8d30d74e7c1860`
saved a Cetus X archive labeled
`World · 2026-10-18T18:50:32.960Z · 0:00–1:04 · finished` and verified it from
reset. After an ordinary reload of that same tab, its manifest remained visible
and complete verification passed again. Opening the recording controls in an
unarmed draft created no additional archive. No deletion or tuning-library save
was performed. [Flight receipt](fpv-flight-continuation-20261018.md).

That newly opened tab initially required the password again and exposed a
different inventory from a previously closed local test tab. Their native
storage-context relationship is unknown. This positive same-tab result does not
account for the six protected public records or establish durability across
contexts, interruption, eviction or disk pressure.

### Later local timing-panel acceptance

A fresh local tab at `http://127.0.0.1:8786/optional-practice/fpv-worlds/index.html`
on `a113208ce8e4076c19b2acc99332c3172e53bfcc` displayed a full sixteen-entry
archive inventory, with entries from 17:57–18:09 UTC. It did not display the later
Cetus archive described above. The initial setup export had revision 0; this
check restored its exact pre-test content after temporary Meteor75 selection
(the expected revision then became 2). The relationship between this tab and
other local tabs, including any `localhost` versus `127.0.0.1` origin difference,
was not established. This is not evidence that the missing public inventory was
recovered, nor proof of data loss within one persistent native context.

The Meteor75 lesson completed while archive saving remained stopped for full
storage. Separate checkpoint recovery succeeded at 20.00 seconds. No archive
was deleted. Same-tab recovery and earlier same-tab archive verification remain
positive observations; cross-context durability remains unqualified.

### Same public tab rechecked without mutation

At 22:12 CEST on 18 October, the existing paused public tab still showed the
single `2026-10-18T17:50:35.065Z` open/incomplete session. **Refresh saved
sessions** completed and retained that same one-entry inventory. The flight
remained paused at 5.30 seconds; no new flight, reload, save or deletion was
performed. This read-only refresh does not recover or account for the six
protected archives.

## Later same-tab local recurrence — reviewed 19 October

On isolated `127.0.0.1:8873`, frozen runtime `7d4e043d7`, the completed Meteor75
archive `World · 2026-10-18T20:44:29.447Z` verified twice and supplied the 14.48 s
course reference. After a later Retry → Practice, autosave reported storage
unavailable at 15.98 s. Restore exposed a closing `IDBDatabase` connection.
The failed restore kept the paused flight and reference intact. A further Retry
and course verification reported **Aircraft archive was not found**, although
the cached picker still displayed the archive. No archive deletion, import,
explicit inventory refresh or page reload occurred in this sequence.

The separately opened emitted Academy build on `127.0.0.1:8874` showed no archived
sessions where preceding acceptance had a 3.88-second record. It remained
unarmed at 0.00 s; no save/import/deletion was attempted. Browser warning/error
logs for the World sequence were empty. These observations broaden the failure
evidence but do not identify eviction, context replacement, disk pressure or a
specific deletion mechanism. The user’s public tab was not touched.

Recovery controls use a different one-slot host database. A separately reviewed
fix invalidates its closed handle and permits one reopen only when transaction
creation fails before requests can be issued. It never retries an admitted write
or creates a substitute for a missing record. Five new regressions fail before
that fix and the complete focused controls suite passes 77/77 afterward. Pending
rendered acceptance and publication, this is R19 resilience work; R13 remains
open and the six protected public records remain unaccounted for.

## Remaining diagnostic gates

The UI correction now removes only a confirmed deleted row from its cached list
and explicitly reports a failed or cancelled following refresh. Initial list
errors are also shown separately. All **19/19** archive controls/integration tests
pass, including EN/UK error and cancellation cases. No storage algorithm changes,
automatic retry or extra deletion were added. The observed public incident
predates this correction; its mutation outcome remains uncertain.

1. Preserve the failed-context observations and stop destructive cleanup. Do not report the six protected sessions as preserved without finding/exporting them or verifying their native records.
2. When an allowed native diagnostic surface is available, capture the exact origin/storage context, database name/version, object-store counts, original exception stack and close/versionchange events before and after one minimal reproduction. Record whether reopening performs a version-zero creation or opens an existing database. Avoid injected deletion, automated cleanup or forced quota changes in the affected profile.
3. In an isolated diagnostic profile, use small disposable archives to check confirmed single-session deletion, preservation of all unrelated IDs, reload retention, interruption during a write and unexpected-connection closure. Verify receipts against actual native records, not only cached UI rows.
4. Repeat retention/reopen qualification on supported browsers/devices with sufficient free storage, while retaining the low-storage negative separately. The machine had approximately 1.1 GiB free during the local investigation; resource pressure, browser eviction/backend failure and storage-context replacement are plausible but **unproven** explanations.

Archive reconnect success alone cannot close this P1 gate. Ordinary flight and separate checkpoint recovery remaining usable do not prove that archived sessions survived.
