# Portable game-data backup and interrupted-import recovery

A `xonix-backup.v1` JSON archive combines the player library, all installed expansion packs and an optional suspended flight. The visible control is **Export game data**: its unchanged file name/schema do not imply that separately uploaded media is included. Embedded supported pack images stay in the JSON; managed still originals need `.rlmedia`, and uploaded music needs `.rlsound`. Individual library, pack and attempt exports remain useful. No archive can add scripts, executables, remote downloads or runtime algorithms.

The pure [backup module](../game/backup.mjs) and [storage coordinator](../game/backup-storage.mjs) are separate. Preparation verifies the entire candidate before it can be adopted. Persistence then uses a durable rollback journal because IndexedDB and localStorage do not share one transaction.

## Use the game controls

Open **Main menu → Scores & saves → Saves & loads → Export game data**. The game downloads `revealline-complete-backup.json` and places the same JSON in the copy/paste area. It includes the current in-memory player library and installed packs. If a normal campaign flight is unfinished, it snapshots that current recording; otherwise it includes the previously suspended flight, if one exists. Practice or completed attempts do not replace that fallback. A flight whose recording is unavailable cannot be silently presented as a complete save.

Choose **Load a saved JSON file**, or paste the file into **Copy or paste save JSON** and choose **Load this JSON**. The game validates all members, preserves an Undo snapshot, then replaces the library, packs and suspended slot through the journal protocol below. It does not start the restored flight automatically: choose **Load suspended attempt** to continue it. **Undo game-data import** restores the previous library, installed packs and flight together using the same validation/storage path. Undo is held in this page session; export first if both collections must remain available after a reload.

Complete backup import is a replacement, not a merge. The separate **Export player library**, **Export installed packs** and **Export attempt** controls remain available for selective transfer. Invalid files leave the current installation unchanged; a storage failure either restores the previous raw data or reports that recovery must finish before further writes.

If startup could not read the previous packs or profile, the fallback session cannot supply an Undo backup of those stored bytes. Importing a valid complete backup can repair that installation, but Undo is unavailable in that case. Exports explicitly identify the current session as their scope. The durable journal still preserves previous raw bytes for rollback if an import fails; it is not an export of unreadable data or a permanent archive after successful replacement.

The game reserves one writing tab for each player-profile channel. Another tab can play, change its own session settings and export its in-memory progress, but cannot persist changes to the owner's library or replace stored packs/flights. To make the second tab writable, close the owning game tab and reload the second; export its session changes before reloading if they should be kept. A browser without the required Web Locks support also runs with session-only progress and export. This is separate from the shorter exclusive lock held during full-backup import.

The visible capacity display reports campaign count, picture count and used profile bytes. The limits are 512 campaign identities, 4,096 picture records and 4 MiB overall; existing pictures are not silently discarded to make room. Archive a complete backup before the limit and retain that file before replacing a collection. Gallery search displays 12 pictures per page; local-score search displays ten setup groups per page. Image bytes live in embedded packs or the separate managed store, so picture metadata counts do not represent artwork's full memory cost.

## Prepare game data and originals together

In **Saves & loads**, choose **Prepare game and originals backup**. The current writable game pauses before this surface opens. Preparation reads the current game-data snapshot and the saved shared-origin picture, story and music inventories, one component at a time. It offers five visible native links:

- `RevealLine-game-data.json`: the existing validated game-data format, including the current unfinished flight when available.
- `RevealLine-originals.rlmedia`: referenced picture/poster originals and retained generic still-domain bytes.
- `RevealLine-stories.rlstory`: story descriptors and their declared-available video originals. Poster bytes remain in `.rlmedia`.
- `RevealLine-soundtrack.rlsound`: the saved music library and its referenced original MP3 bytes, independent of whether the audio player can initialize.
- `RevealLine-backup-coverage.json`: a readable coverage report with edition/channel, source revision when the build records it, capture time, domain generations, metadata hashes, distinct original counts, and each component's filename, byte length and SHA-256.

**Prepared** means that the existing serializers checked those bytes. Choose each **Download** link yourself; **Download requested** only describes the browser action. Confirm the resulting files at the destination and compare them with the coverage report. The immutable report records preparation, not later browser download outcomes. Links remain available to retry while this Library visit stays open. Preparing again, closing the Library, hiding/leaving the page or detecting changed game data releases this panel's URLs. Cancel stops publication and joins any pending read before another preparation can start. Escape/controller Back first cancels active preparation and keeps focus in the Library; Close may leave immediately while cleanup settles. None of these actions resumes the flight.

All four component formats, their validators and storage limits are unchanged. The coordinator adds an aggregate preparation bound of `MAX_BACKUP_BYTES + 256 MiB + 8 MiB`; it can refuse a very large combined set even when individual exports remain possible. Hashing is sequential and bounded by each existing file limit, but it still needs memory for one component's bytes. No new database, archive format, writer lease, media transcoding or restore transaction is introduced. The existing build includes these modules through its `game` include.

The coordinator brackets all exports with the same manager's atomic generation snapshot and checks each returned generation. It re-reads full game contents with the same capture timestamp and checks current game identity before native link activation. This establishes a stable observed snapshot under the existing monotonic writers; it is not a lock across localStorage and IndexedDB, protection against arbitrary database reset, or a promise that storage cannot change after preparation. Prepared files remain an immutable snapshot of the reported interval. Ordinary library changes invalidate the links; prepare again after editing originals elsewhere.

Unsaved editor drafts, other game profile channels, unreferenced blobs, browser caches and unavailable downloads are excluded. A missing or corrupt declared-available original fails the entire preparation. Intentionally detached stories remain named in the report and produce an explicitly **incomplete** set; a retained descriptor is not a recovered video. Training, unresolved storage recovery and a non-writing game cannot prepare all inventories through this coordinated entry. Existing individual/session-only exports remain available under their own rules.

Restore through the existing reviewed tools: picture/poster `.rlmedia` first, `.rlstory` next, saved music `.rlsound` separately, then review/import game-data JSON after its original owners are available. Earlier restored originals remain if a later step refuses. The coverage report is not an import authority and does not provide atomic rollback across files.

Focused source tests exercise actual finite PNG, MP4 and MP3 bytes through the unchanged serializers, concurrent generation/profile changes, detached/missing originals, cancellation, native-link cleanup and the actual paused solo host. DOM/media boundaries are modeled. The separate [native download record](verification/guided-backup-a858-downloads.md) verifies all five actual files for an empty player profile/default saved metadata, including the CLI on both Node versions. Custom-uploaded media, fresh-origin restore, codec playback, audible music and cold-offline journeys remain unqualified.

## Check files actually downloaded

Keep each five-file set in its own new folder with the exact names in that set’s coverage report, then run this read-only command from the source checkout with supported Node 20/22:

```sh
node scripts/check-backup-set.mjs --report "$HOME/Downloads/RevealLine-backup/RevealLine-backup-coverage.json"
```

Use `--directory /path/to/components` if the report is elsewhere, or `--help` for usage. The checker never copies, repairs, imports or adopts files. It refuses unsupported reports, duplicate/unsafe filenames, symlinks, missing components, size/SHA-256 mismatches and files that change during inspection. Extra unrelated files are not read. Browsers may add a suffix such as ` (1)` when fixed names already exist. Move that one complete set into a new folder and restore only its report-declared names there; do not overwrite or mix older exports. The command never chooses the newest file, guesses a renamed member or renames it for you.

A successful JSON result means the actual four component files match the supplied report. It also checks bounded binary manifests, referenced-original hashes, paired story/poster metadata and structural MP3 frame facts through existing source validators/inspectors. The game-data check identifies its bounded JSON envelope; it does not replay the saved flight or authorize progress. File hashing uses 64 KiB reads; existing per-file/per-original bounds still apply to metadata and media inspections. No native codecs or media database are opened.

A later small UX enhancement can give all five guided files one unique preparation prefix and record those exact names in the report. That is not implemented here; legacy individual export filenames and current guided filenames remain unchanged.

The report is not signed: matching it does not prove trusted provenance, earned-picture/story ownership, compatibility with another edition, successful restoration or native decoding/audible/offline playback. Detached stories remain explicitly incomplete even when all provided files verify. Preserve the output alongside the original files, then use the existing import reviews for an actual transfer. Do not treat this command as a substitute for native download/readback when no actual destination files are available.

## File and preparation contract

```json
{
  "format": "xonix-backup.v1",
  "library": { "format": "xonix-library.v1", "...": "complete player export" },
  "packs": { "format": "xonix-pack-library.v1", "packs": [] },
  "session": null
}
```

This is an illustration; real exports contain the complete existing member formats. `library` may use its validated v1/v2/v3 format; `session` must be `null` or a complete validated `xonix-session.v1`, `.v2` or `.v3` attempt. V3 sessions carry exact picture choices, and v3 libraries can carry first-earned receipts. Old v1/v2 files retain their original artwork semantics; imports do not attach today's managed assignments to them. The archive does not include game executable files, cached offline files, legacy motion-lab profiles, external reference archives or server accounts. The schema contains the suspended flight supplied by its host. The current UI supplies a fresh snapshot of an unfinished normal campaign flight, falling back to the existing saved slot only when there is no such current attempt.

| API                                               | Result                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `prepareBackup(candidate, options)`               | Asynchronously return frozen `{library,packs,session}` after all validation; reject on any error |
| `validateBackup(candidate, options)`              | Alias of full preparation, including image decoding and replay verification                      |
| `exportBackup({library,packs,session?}, options)` | Prepare and return compact JSON; omitted session becomes `null`                                  |
| `isPreparedBackup(value)`                         | Check the in-process preparation capability required by the storage coordinator                  |
| `MAX_BACKUP_BYTES`                                | Outer file-read and parse limit, currently 84 MiB + 32 KiB                                       |

Options are `{campaigns:[], decodeImage, signal, onProgress, resolveCampaign, expandCampaigns, resolveMediaIdentityCatalog}`. `campaigns` contains trusted built-in authored content. Included packs supply their own validated campaigns/rosters. Optional synchronous `resolveCampaign(key)` may reconstruct a known dated challenge, returning that exact identity or `null`; it cannot fetch uninstalled content or trust file-supplied algorithms. `expandCampaigns(originals)` derives exact Standard/Gentle execution contexts from trusted originals plus the archive's own packs. The current UI registers `[baseEntry.campaign]` and the known dated resolver; unrelated installed packs cannot supply a missing flight's rules.

The module snapshots input data and trusted campaign arrays before asynchronous work. Profile validation uses the current migration rules. Pack preparation checks all dependencies, schema/header and image budgets, then fully decodes each image. If a flight exists, the module reconstructs and verifies its replay against an included or trusted campaign and its class roster. A self-consistent recording with different installed rules is rejected. Unknown historical profile partitions remain as metadata under the existing library contract; a missing-pack flight cannot resume from metadata alone.

Use the real browser decoder in the UI. The injectable decoder exists for other hosts and tests; a header-only fixture does not establish that actual media decoded. Abort is checked before work, between image operations and during asynchronous replay verification. An image decoder already running may finish before cancellation is observed.

For a legacy-only file, the minimal preparation path remains:

```js
import { prepareBackup, exportBackup, MAX_BACKUP_BYTES } from './backup.mjs';

// File size must be checked before allocating the text or parsing JSON.
if (file.size > MAX_BACKUP_BYTES) throw new Error('Full backup exceeds its file budget.');
const ready = await prepareBackup(await file.text(), {
  campaigns: [baseCampaign],
  signal: controller.signal,
  resolveCampaign: resolveKnownDailyCampaign,
  onProgress: ({ ticks, total }) => showReplayProgress(ticks, total),
});
// Do not replace live library/packs/session until coordinated storage succeeds.
const json = await exportBackup(ready, {
  campaigns: [baseCampaign],
  resolveCampaign: resolveKnownDailyCampaign,
});
```

The combined limit accommodates the existing 48 MiB pack-library, 4 MiB player-library and 32 MiB + 16 KiB session limits, plus envelope overhead. Each inner limit still applies. The parser rejects oversized strings before JSON parsing, and bounds nodes, depth, array lengths, finite numbers, fields and keys. Functions, accessors, `toJSON`, cycles and prototype-related keys fail. Keeping embedded pack images plus several validated snapshots consumes memory; these are ceilings, not recommended pack sizes for a low-memory phone.

## Paired originals and exact picture ownership

When a file contains a v3 session or picture receipts, preparation requires `resolveMediaIdentityCatalog({originals,packs,campaigns})`. This is a trusted **synchronous factory returning a branded catalog**, invoked only after included packs and any dynamic execution have been resolved. Capture awaited stored media metadata before constructing it. `originals` are trusted authored bases and included pack campaigns; `campaigns` includes actual execution contexts and must not be relabeled as authored owners. Themes come only from exact included pack/base ownership or verified retained owners, never matching names, suffixes or unrelated installed worlds. The implemented [factory](../game/ui/picture-identity.mjs) normalizes effective levels/rosters and validates exact Standard/Gentle identity.

For a pinned file, capture the media snapshot first, then supply the synchronous resolver to both preparation and export:

```js
import { createBackupPictureIdentityResolver } from './ui/picture-identity.mjs';
import { expandDifficultyCampaigns } from './campaign-contexts.mjs';

const metadata = await stills.readMetadata({ signal });
const options = {
  campaigns: [baseEntry.campaign],
  expandCampaigns: expandDifficultyCampaigns,
  resolveMediaIdentityCatalog: createBackupPictureIdentityResolver({
    baseEntries: [baseEntry],
    metadata,
  }),
  signal,
};
const ready = await prepareBackup(candidate, options);
const json = await exportBackup(ready, options);
```

The source UI tolerates unavailable unrelated media metadata for legacy-only game-data exports/imports. A pinned file still needs enough exact owner metadata to validate; missing or corrupt historical owners must fail truthfully. JSON preparation verifies pins, owners and replay, not the existence of every original. A valid saved file may be imported while its image is absent. Explicit Load then remains paused and asks for `.rlmedia` recovery without replacing the saved pin; it never substitutes the latest assignment.

Restore reviewed `.rlmedia` originals before game data when possible, then restore `.rlsound` separately. The JSON journal covers profile/packs/suspended slot only; it does not write or roll back the managed-original inventory. If JSON import fails or is undone, imported originals remain intact. Assignment restore/Undo likewise preserves append-only history. Native file preparation and download are separate actions: retain actual downloaded bytes and hashes before claiming recovery. [Original bundle inventory](media-bundle.md), [soundtrack inventory](soundtrack-library.md), [live pins](flight-pictures.md).

## Durable coordinated import

Use these adapters for `commitBackup(ready, adapters)` and `recoverBackupImport(adapters)`:

```js
const adapters = {
  storage: localStorage,
  readAsset: readAssetStore,
  writeAsset: writeAssetStore,
  profileKey,
  packsKey,
  sessionKey,
  journalKey,
  lockKey: `${profileKey}.backup-lock`,
  commitProfile: (library, options) => guardedProfileCommit(library, options),
};
```

`readAsset(key)` returns the stored value or `null`; `writeAsset(key,value)` resolves only when its IndexedDB transaction completes, or throws/returns `{ok:false,warning}`. This follows the distinction between an individual request and the [IndexedDB transaction completion event](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event). New packs are stored as the existing portable JSON string. A journal is a plain JSON object; writing `null` clears it. The local adapter provides synchronous `getItem`, `setItem` and `removeItem`. Keys must be distinct.

`commitProfile(library,{mode:'replace',writeLock:{key,token}})` must use the guarded profile writer and return `{ok:true,...metadata}` only when persistence succeeds. Replacement starts the writer's new generation; incoming backup files never select an authoritative storage generation. The coordinator returns that metadata as `result.profile`, allowing the shell to refresh its baseline/generation. Do not call an ordinary merging save for this operation. The callback must only persist and return metadata: it must not adopt the new profile into live application memory before the coordinator succeeds, because a later journal-clear failure can still trigger rollback.

The coordinator takes an exclusive Web Lock named by `lockKey`. A host can inject `withLock(task)` with equivalent exclusive cross-context ownership. Without either, full coordinated import/recovery refuses to mutate data; individual exports remain available. A plain localStorage token alone is not an atomic cross-tab mutex. [MDN Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) documents exclusive ownership across a shared origin, release after the asynchronous callback finishes, and the secure-context requirement.

While holding the exclusive lock, the coordinator writes a plain owner token to `lockKey`. Every ordinary profile writer must honor `{key:lockKey,token:null}`; the guarded profile API does this by default. Ordinary pack installs/removals, session saves/deletes and other authoritative UI writes must also honor the same lock. Only the owning full import/recovery may bypass it with the owner token. Other readers should pause live adoption while the import lock exists.

The ordered operation is:

1. Reject an existing recovery journal or orphan lock; require successful startup recovery first.
2. Hold the owner token, then capture previous raw profile/session strings and raw pack-store value. Even incompatible previous bytes are preserved within the journal budget.
3. Persist the complete `xonix-backup-journal.v1` rollback record before changing game data.
4. Write new packs, write/remove the session slot, then commit the replacement profile with owner credentials.
5. Clear the journal last, release ownership and return `{ok:true,profile,warning}`. Only then adopt the prepared objects in the live UI.

The local suspended-attempt slot still has a 2 MiB limit. A larger valid portable flight is accepted by archive preparation but refused by coordinated local-slot persistence before journaling. Retain the archive and use its portable attempt separately for that case. Normal browser quota failures are also possible below these explicit limits.

On apply failure, the coordinator restores all prior raw values and clears the journal only after rollback finishes. `{ok:false,rolledBack:true}` means previous storage was restored. `{ok:false,recoveryRequired:true}` means recovery remains unfinished: retain the original archive/journal, stop ordinary writes, and retry startup recovery after storage is available. If journal clearing reports an uncertain failure, the coordinator re-establishes its recovery record before rollback. Lock-cleanup failure after a fully committed import can return `ok:true` with a reload warning; exclusive startup recovery clears that orphan token.

## Startup and crash behavior

Run `await recoverBackupImport(adapters)` **before** ordinary profile, pack or suspended-slot reads. If it returns `ok:false`, preserve the journal and avoid loading a mixed installation into normal play. Display its actionable warning. A valid pending record restores the previous raw data, even if the crash occurred after new profile bytes were written. A crash after the journal was cleared keeps the committed new installation; exclusive recovery only clears any remaining owner token.

Recovery is repeatable. A failed restoration leaves the journal for another attempt. Malformed journals or records naming different storage keys cause no game-data writes and remain available for diagnosis. An unrelated import cannot replace a pending journal. The journal has a bounded 168 MiB + 80 KiB ceiling to accommodate escaped previous raw strings; it temporarily requires additional IndexedDB capacity. Failure to store it prevents the import from touching player data.

This is a recoverable write protocol, not a transaction spanning browser stores. Its guarantees depend on the supplied storage adapters, completed write acknowledgments and every application writer respecting the lock. Clearing site data, storage eviction, device loss or host-added code outside this protocol can remove recovery data. Keep an exported backup outside the browser. [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) explains why browser persistence is not an external backup. No cloud service receives these files.

## Verification

Run:

```sh
node --test game/test/backup.test.mjs game/test/backup-storage.test.mjs
```

The tests exercise complete member round trips, preserved embedded image bytes, real live-cut continuation in both policies, included-pack and dated-campaign resolution, changed installed rules, async caller mutation, malformed/executable data, cancellation and size limits. Storage tests cover every apply/crash stage, missing prior entries, raw corrupt-data preservation, profile-generation handoff, journal failure, uncertain acknowledgments, failed rollback/retry, pending import refusal, orphan locks and same-page concurrency.

The original backup/storage suite uses injected storage and decoder boundaries. Its historical browser check exercised the former **Export complete backup → import → Undo** labels with native IndexedDB/Web Locks and second-tab writer isolation; that remains evidence for its original build. Current source adds strict v3 owner/factory, live saved-picture and first-earned tests, and exact 2aa passes all six gates/2,707 tests. Actual source-browser native JSON + `.rlmedia` fresh-origin recovery, Undo preserving originals, shared `.rlsound` bytes and missing-original Load refusal/recovery are recorded in [the current receipts](feature-delivery-workflow.md#current-still-integration-evidence). Frozen/public P5, cold offline paired recovery, quota/crash stress, other browsers and physical devices remain separate gates. See [library/packs](library-and-packs.md), [replays](replays.md) and [public-release gate](public-release.md).
