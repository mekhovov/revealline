# Installed original pictures in Couch

Couch starts with the shipped **Pressure Lines · Arcade** chapter and its wide,
contained originals. **First Signal · Tactical** remains an explicit choice. A
race uses the selected chapter's authored controls, dimensions, class and world;
Couch does not convert Tactical missions into Arcade missions.

In **Race setup**, the map selector also lists installed maps from this exact
profile channel. Install or recover chapters in solo **More worlds**, then use
**Refresh installed chapters** here. Refresh preserves the selected owner. It
never chooses a different chapter, starts a race, or resumes the solo flight.
An unavailable selected chapter stays unavailable until it is repaired or the
player explicitly chooses another map.

Selecting an installed map checks its pack and descriptor, authenticates every
original in that chapter, then fully decodes the exact selected original. Start
stays disabled until the picture is ready. Both boards borrow that one image;
they still have independent core states, directions, lives and results. An
explicit Start rechecks the prepared ownership snapshot before the first tick.
Pausing retains the accepted image and each player's continuation. A new round
checks its original again and waits for another Start.

Back cancels pending picture work. **Retry chapter picture** retries the same
selection without starting it. Retry and Refresh return focus only while the
initiating control still owns that interaction. A newer selection, Back or user
focus movement prevents an older completion from moving focus. Terminal page
exit disposes images and object URLs; a persisted pagehide pauses the race and
retains its owned pictures for the browser's back/forward cache.

## Read-only authority

`game/couch/couch-installed-chapters.mjs` uses the existing chapter host's checked
snapshot, authored-picture and current-snapshot operations. It borrows one DB4
manager and owns one accepted image binding. It does not acquire a profile writer
lease or expose installation, recovery, replacement, progress, saved-attempt,
Collection, story, backup or media-edit operations. A first database read may initialize the existing schema; this is not a promise
of zero IndexedDB schema writes. No profile or content mutation is requested.
The external host, pointer
store, media store, descriptor registry, identity readers and core are unchanged.

The same raw development or release version channel used by solo selects the
pack/index keys. A URL path is not a new namespace. Channels such as
`release-v0.37.0` and `release-0.37.0` remain distinct. The DB4 database is shared,
but a chapter's full descriptor and exact original owner determine its picture;
matching a level name or world alone does not permit borrowing another picture.

The adapter serializes and joins cancelled authority operations. It checks the
pointer/index/journals and media generation after decoding, and repeats the
snapshot check before Start. Closed, stale, missing or corrupt originals produce
a visible failure and a disabled Start; compact pack JSON is not a replacement
for original bytes. A decoded image already held by a paused race is retained
until that race is replaced or disposed, even if another page changes storage.
Existing saved attempts and first-earned identities are not rewritten.

Older embedded packs retain their authored image and fit through a separate
validated embedded path in the same binding owner. An older authored map without
a background retains its existing procedural presentation. That fallback never
applies to a chapter identified by the external descriptor index.

## Focused validation

The focused tests exercise the real original payloads, chapter host, shared media
metadata, native-transaction model and Couch host/core/input adapters. They check
owner rejection, post-decode metadata drift, pointer drift before Start, missing
index/originals, joined cancellation, shared board images and independent motion,
no solo writes, and asynchronous Retry/Refresh focus. The IndexedDB and image
boundaries are finite test models; browser storage durability, actual image
rendering and physical controller behavior need separate native observations.

Run with the project's supported Node runtime:

```sh
node --test game/test/couch-installed-chapters.test.mjs game/test/couch-chapter.test.mjs
```

No site build, publication, runtime adoption or qualification of every installed
mission follows from these focused checks.
