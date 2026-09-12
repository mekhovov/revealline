# Continue and copy a collection

The v0.4.0 working game offers the next accessible uncleared mission when a campaign opens. An explicit mission selection still replays that mission. A completed campaign opens its completion view instead of silently starting over; use **View collection** or **Choose a mission**. Optional medal goals do not prevent ordinary continuation.

When an unfinished flight is saved, **Load saved flight** shows its campaign/mission when available. Its preview is a label, not verification: loading reconstructs the recorded attempt and checks it before adoption. The restored flight stays paused until Resume. A rejected save leaves the current run available.

## Bring an earlier release forward

In a release build, open **Library & saves → Saves & loads → Bring progress from an earlier release**:

1. Close any other tab playing the earlier release. Export the current destination's complete backup if you want to keep both collections after this page closes.
2. Select the earlier release and choose **Review saved progress**. Review completed maps, pictures, scores, campaign and pack counts, and whether a saved flight is included.
3. Choose **Copy reviewed progress**. The source is read and verified again. If its content changed after review, the summary updates and copying waits for another explicit Copy action.
4. On success, the destination contains the source's player library, preferences, installed packs and saved-flight slot. Load its saved flight explicitly when ready. **Undo complete backup import** restores the destination snapshot while this page remains open, when that snapshot could be verified.

Copy replaces the destination collection; it does not merge it or continuously synchronize versions. The earlier release's stored bytes remain unchanged. **Cancel check** stops preparation before the destination commit begins. Once storage commit starts, its existing recovery journal handles failures; see [full backups and recovery](full-backup.md).

Removed expansions can leave earned picture records behind. The review names missing pack IDs and preserves those records; reinstall the original pack to view its art. A saved flight that requires absent or mismatching campaign content cannot be transferred as a valid resumable attempt. An unreadable source or pending source recovery is an error, never an empty replacement. Open that earlier release to recover/export it first.

The source list is only a bounded discovery result; **Review** verifies the actual data. It recognizes earlier stable release channels from v0.2.1 onward and the verified v0.2.0 legacy channel. Prefixed and unprefixed build labels remain distinct sources. Development, the motion lab, older incompatible saves, the current version and future versions are excluded.

This feature reads the same browser storage origin. Changing `localhost` to `127.0.0.1`, changing the port, or changing HTTP to HTTPS selects different storage. Another browser, device or native origin needs **Export complete backup** in the old game and file import in the destination. Browser storage is local and may be cleared or evicted; a copied collection is not an off-device backup. [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) and [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) explain these boundaries.

## Maintainer contract

`game/profile-transfer.mjs` exposes:

```js
const sources = discoverProfileTransfers({ storage, currentVersion });
const reviewed = await prepareProfileTransfer(sourceId, {
  storage, readAsset, lockManager, currentVersion,
  campaigns, resolveCampaign, decodeImage, signal, onProgress,
});
// reviewed: { source, preview, prepared, fingerprint }
```

`sourceId` is the exact channel, such as `release-v0.3.0`, `release-0.3.0` or legacy `release`. Do not reconstruct source keys from UI text. Discovery checks at most 4,096 storage keys and returns at most 32 candidates without loading their values.

Preparation acquires the source's actual `${profileKey}.writer` Web Lock, then `${profileKey}.backup-lock`, using exclusive `ifAvailable` requests. A busy source fails promptly; no lock is stolen. It rejects a non-null local backup token or IndexedDB journal, then reads profile, packs and suspended slot under both locks. The module has no storage write/delete adapter. Participating Web Locks remain held until their callbacks finish; cancellation is handled inside these callbacks because the API forbids combining `signal` with `ifAvailable`. [MDN LockManager.request](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request)

The profile must be a valid non-null library or storage envelope. Only a successful `null` read means no optional pack library or saved slot. `undefined`, exceptions, invalid JSON, accessors, prototype keys, failed image decoding and replay mismatches reject. The existing member validators and size budgets remain authoritative; the local saved slot is limited to 2 MiB. The default asynchronous deadline is 120 seconds, configurable up to 300 seconds. Synchronous parsing and canonical serialization remain bounded by content size rather than being preemptible.

`prepareBackup` supplies the actual immutable prepared-backup capability; do not replace it with a shape-compatible object. The host supplies trusted base campaigns and a dated-challenge resolver. Included packs resolve their own campaigns. The destination retains its writer lease and applies the prepared value through the existing journaled backup/Undo path. No multi-store database transaction is implied.

`transferFingerprint(prepared, { digest? })` hashes canonical, normalized `{library, packs, session}` content with SHA-256. The optional trusted digest accepts a `Uint8Array` and returns exactly 32 digest bytes. The default uses Web Crypto. `prepareProfileTransfer` computes the fingerprint while it still holds both source locks. The `sha256-…` value detects content changes; it is not a signature or ownership proof. JSON key order, whitespace and local storage generation do not change it. Preferences, awards, image bytes and saved-flight metadata do.

At Copy, prepare a fresh source and compare **both** `source.id` and `fingerprint` with the reviewed result. If either differs, show the new preview and return without changing the destination. On a matching result, apply that fresh prepared snapshot. Do not add ambient dates, hostnames or UI selection state to the digest, and do not reuse a stale preview as proof of the current source.

## Verification

```sh
node --test game/test/profile-transfer.test.mjs game/test/backup.test.mjs game/test/profile-writer.test.mjs
```

The transfer suite covers real progress and active-cut restoration, exact image preservation, source lease conflicts, pending/corrupt journals, missing/corrupt/oversized inputs, getters/prototype keys, cancellation and late reads, changed reviews, and deterministic SHA-256 output. An additional test hashes the complete authored Homeward pack: the inspected 11,371,849-byte pack produced 11,366,131 canonical snapshot bytes. One local Node run took 1,963 ms for preparation and 34 ms for a repeat fingerprint. Its decoder reports image-header dimensions only; these are data-path timings, not browser decode, native-device performance or enjoyment evidence.

For AI-assisted work, use [Runtime Maintainer](../authoring/skills/xonix-runtime-maintainer/SKILL.md). The [returning-player research](research/round-14-player-continuity.md) explains the design rationale and separates observed reference behavior from recommendations. Archived release evidence stays attached to its original revision.
