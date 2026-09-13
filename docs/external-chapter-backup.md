# External chapter game-data backup

This is an optional source companion for the reviewed three-original external chapter pilot. Host adoption and native browser qualification are separate. It does not change the frozen v0.35.0 release, the public chapter catalog, ordinary chapter removal, existing embedded-edition migration, or any media database schema.

Game JSON contains the player library, installed gameplay packs, saved flight and, in the explicit new format, the exact external descriptor index. It contains no original picture, movie or audio bytes. The existing `.rlmedia`, `.rlstory` and `.rlsound` files keep their separate scopes. For a fresh target, restore the exact `.rlmedia` first, then explicitly restore the game-data JSON. Restore story/movie and custom music companions separately where needed. No download-to-disk or cross-device recovery claim follows from the modeled tests.

## Explicit compatibility

`xonix-backup.v1` remains the strict four-field envelope (`format`, `library`, `packs`, `session`). Its existing prepared object and compact export bytes remain unchanged. New `xonix-backup.v2` has one additional required field, `externalChapters`, containing the existing `revealline-external-chapter-index.v1`. The normal pack, library, session, picture and story schemas are unchanged.

V2 requires a trusted external preparation callback. Every indexed descriptor must equal an explicitly registered descriptor; normalized pack bytes, SHA-256, map count, theme, authored campaign owner, no embedded visual override and unchanged pack-plus-index 48 MiB budget are checked. A known compact external pack without its index refuses. An unknown descriptor cannot register itself through a backup. Preparation/export can preserve metadata whose original bytes are unavailable; it makes no readiness claim.

An explicit v2 empty index is meaningful. It supports replacing the pack/index set and the panel's one-step Undo without inferring removal intent from an old v1 file. A v1 file cannot replace an already indexed target. Replacement changes no media records or original bytes: retained historical owners, picture revisions, current assignments, movie history and first-earned pins remain available. The ordinary backup validator still refuses to discard a pack required by its saved flight. A collected picture can continue to resolve through retained exact owner metadata even after its gameplay pack is removed by this explicit replacement.

## Coordinated host hooks

Construct one borrowed capability after the exact profile keys and trusted registry are available:

```js
import { createExternalChapterBackup } from '../game/external-chapter-backup.mjs';

const companion = createExternalChapterBackup({
  indexedDB,
  storage,
  profileKey,
  packsKey,
  writer,
  lockManager,
  getManagedStore, // the existing shared DB4 manager; never a second owner
  registeredEntries,
  knownDescriptors,
  decodeImage,
});
```

The factory is lazy with respect to media. It borrows an adapter only when a target commit needs original-byte readiness, and `close()` closes its adapters, not the shared manager or profile writer. Current ordinary/practice/course/audio/workshop database ownership is unchanged.

The agreed Library API hooks are:

- `assertExternalBackupSupported({kind})`: initially the conservative host guard; replace with `companion.assertSupported` only after the complete integration is reviewed. `kind: 'backup'` permits the v2 route after pending-state checks. `kind: 'packs'` refuses indexed pack-only export because it would omit the descriptor. Omitted callbacks preserve legacy hosts.
- `backupPreparation: {prepareExternalChapters: companion.prepareExternalChapters}`: trusted preparation options, never serialized data.
- `backupSnapshot: () => companion.snapshot(getContents)`: `getContents()` synchronously returns the current paused `{library, packs, session}` inside the existing backup lock. The companion compares the current pack value to the persisted pair and rechecks both snapshots. It returns explicit v2 index metadata, including an empty index for later Undo. It never replaces a live run with a separately stored session.
- `backupAdapters().externalBackup = companion`: `commitBackup` and `recoverBackupImport` consume the branded capability directly. The host supplies its existing guarded profile commit and exclusive backup lock. Do not wrap this path in another acquisition of that same lock.
- `profileTransfer.readExternalSnapshot = companion.readExternalSnapshot`: `prepareProfileTransfer` already holds the source writer and backup locks. The reader uses the source's own exact keys, including legacy `release`; it never borrows the target index or writes the source. Raw profile/session strings and the coherent raw asset snapshot join the prepared-content fingerprint. Review/copy must repeat preparation and compare the returned fingerprint.

App/startup/pack/workshop wiring belongs to the separate external host integration. Keep its conservative guard until this entire slice and that wiring are reviewed. The normal `host.commitMutation` and `packCommits.commit` remain prohibited through a backup's own journal. A dedicated legacy writer is still needed for a v1 recovery journal with no external index. Portable attempt export retains its existing exact session and media-pin format; it does not export a descriptor or originals, and restoration still requires matching content.

## Recovery protocol

The native assets adapter reads packs, descriptor index, backup journal and external-install journal together in the existing `revealline-assets-v1/assets` transaction. No new object store or database is created. Opening and transactions have finite 15-second bounds. Data is owned before async publication; native mutations require the current writer and matching local recovery marker.

`xonix-backup-journal.v2` retains exact raw previous profile/session strings and pack/index values, plus the intended new pack/index pair. Target keys and token are exact. Keeping both authorized pairs lets restart recovery reject an unrelated later write instead of overwriting it.

Commit runs under the existing exclusive backup lock. Before writing its marker or journal, it validates the target's immutable authored poster records and reads every required original through the real shared still adapter, checking size, SHA-256, header and decoded dimensions. It rechecks media generation and the native pair. It then publishes the owned journal, rechecks readiness, changes packs and index in one native transaction, writes the local session/profile through the existing guarded replacement protocol, and clears only its own journal.

This is a recoverable sequence across the assets database and local storage, not a cross-database transaction. If local writes fail, rollback atomically restores the old pack/index pair, restores exact raw local values, then clears the journal. Failure or uncertain finalization retains the journal/marker for later recovery. Re-establishing the journal and restoring the pair occur in the same native transaction. A foreign token, unrecognized current pair, external-install journal, mixed journals, or legacy v1 journal beside an external index refuses without clearing recovery state.

Startup must inspect both journals before ordinary profile/pack/session adoption. An external journal needs the external installer review; a backup v2 journal needs this companion. A successful durable import is followed by a separate fresh host inspection and catalog adoption. A later inspection failure is a readiness failure, not evidence that the committed backup rolled back.

## Verification boundary

Focused tests use the actual reviewed three-image compiler/payload, existing shared DB4 adapters, real SHA-256 and original bytes, actual core win/saved-flight validation, and a finite native-transaction model. Browser decoding is modeled from authenticated PNG headers after the compiler's full PNG checks. They cover metadata-only export, exact descriptor refusal, separate original restore, native pair publication, explicit Undo, retained owner/earned-picture resolution, saved-pack requirements, mixed/legacy journals, raw rollback, restart recovery, corruption, cancellation, media-generation changes and source transfer with no writes. Existing ordinary backup/profile-transfer and story transfer cases remain required.

Native export-to-disk, fresh browser import/Undo, interruption recovery on real storage, quota behavior, cold/offline and physical-device qualification remain separate acceptance steps. Existing embedded pack migration and ordinary external Remove remain out of scope.
