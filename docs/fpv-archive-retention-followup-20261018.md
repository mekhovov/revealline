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
