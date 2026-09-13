# Optional story runtime integration

This successor source joins the reviewed story storage, transfer, binding and workshop APIs into the game. It is not a frozen or published release. Published v0.34 remains unchanged. Native browser, packaged/offline artifacts and a distributable Dawn Signal example are separate acceptance gates; an uploader alone does not constitute a delivered story.

The current game and standalone Picture Workshop select one compatible managed database v4 for soundtrack, stills and stories. Practice and First Flight use the same audio adapter but keep their authored pictures, create no story/picture pins and award no campaign progress. Opening v4 preserves existing v1/v2/v3 rows and original bytes; older immutable clients requesting a lower version are incompatible. Use this newer edition’s workshop to export the originals. Never clear, delete or downgrade the database to silence a version error.

## One selection, one attempt

`createStillMediaStore.readPresentationMetadata()` reads `mediaRecords/library` and `storyRecords/library` in one readonly transaction. It validates the retained owner catalog and the shared 2 MiB metadata budget without loading all original Blobs. The still snapshot remains privately branded for targeted acquisition. Audio, movie and image bytes are obtained and verified separately when needed; a metadata receipt is not proof that the corresponding bytes are present.

A fresh ordinary attempt freezes `revealline-flight-pictures.v2`. Each bounded theme choice contains its old exact picture pin and an explicit nullable story reference: ID, immutable revision, canonical descriptor SHA-256 and original SHA-256. All existing 8 KiB/64-theme limits remain. Story metadata is owned and verified before selection returns. An edit committed during selection cannot mix poster and story generations. Once selected, changing an assignment/binding affects a later fresh attempt.

`xonix-session.v4` carries these pins with the unchanged replay and continuation. The v1/v2/v3 session parsers retain their original meanings and shapes; a saved v3 flight has no movie even if a story is later authored. Saved v4 choices are validated against their exact execution-to-authored catalog. The movie descriptor is resolved through immutable retained history, not the current binding. Missing video availability keeps that exact pin; it does not select a replacement story or alter simulation.

## Win first, then optional playback

`xonix-library.v4` contains the existing picture receipts, bounded `revealline-earned-story.v1` rows and a separate `cinematicVolume` value. The two receipt lists share the existing 2 MiB allowance within the unchanged 4 MiB profile budget. A story row must match the same gallery key, first-earned run ID and full picture pin as its picture receipt. Explicit null and old gallery rows never gain a story retroactively.

The host records a legal win and uses its existing guarded profile save before exposing **Victory story** in results. Better subsequent results may improve the score/seed while the first-earned poster and story stay fixed. No movie transaction is needed during completion: its original was committed before the flight, and retained media history remains append-only. There is no new pruning/GC or inferred live-pin lease system.

Results use that attempt’s selected story; **Play earned story** in Collection uses the first-earned receipt. Collection validates exact execution ownership through the retained still owner catalog, including Gentle and unavailable installed packs. Retention alone does not reinstall a campaign or enable gameplay Replay.

Both actions open the same native story dialog through the existing modal/controller navigation. The already decoded exact poster is staged first. Only the selected movie is acquired, checked against its descriptor/hash and inspected by the native codec. Play is explicit; Skip returns to the same poster. Close, page lifecycle and a changed context cancel pending work and release the owned view/URL/music lease. Blur pauses playback; a visible return never silently resumes it. Missing/corrupt movie bytes leave the poster visible with one actionable `.rlstory` recovery message. They do not report a played story or retry in a loop.

Cinematic volume is independent of soundtrack volume, playlist and listening intent. It also respects master volume and mute. The current soundtrack player lends a temporary gain factor; the lowest active lease composes with its base/fade/master settings. Closing a story releases only its own factor. The cinematic slider uses the existing guarded profile write and preserves old preference schemas. Playback, Skip, Replay and Close do not award or write completion data.

## Authoring and transfer boundaries

Picture Workshop now injects the same v4 manager into still, audio and story adapters and routes controller Back to `panel.back()`. A first Back cancels a pending prepared task; later Back closes. Explicit upload/inspection, captured poster save, Prepare/Save story, native download and reviewed restore keep their existing validation, CAS and cancellation contracts. Authoring does not grant an earned picture.

- `.rlmedia`: every referenced still/generic original and retained still owner history; assignment restore policy is explicit.
- `.rlstory`: immutable video descriptors/originals and explicit bindings; the exact historical poster must already exist. It does not supply game progress.
- Game-data JSON: versioned library/session metadata plus its existing pack boundary. It carries pins/receipts, not image/movie bytes. Its existing journaled import/Undo remains atomic.
- `.rlsound`: soundtrack metadata and exact MP3 originals; it does not contain video or stills.

Restore the original media files and game-data JSON through their separate reviewed actions. A metadata-only backup is not a complete originals backup, and successful import does not prove native codec availability. The new v4 session requires the same synchronous branded owner factory even when its profile has no earned receipts. Foreign/absent owners refuse before target writes; an interrupted JSON import retains the existing rollback/Undo behavior.

## Qualification

Focused tests exercise actual core wins/unfinished cuts and first-earned metadata, modeled IndexedDB transactions, old-format compatibility and journaled transfer/Undo. The dialog and host use modeled DOM/media/Canvas boundaries; these checks are not actual browser, physical controller, touch, audible-output or cold-offline qualification. Initial failed test fixtures and the manager’s first-abort-reason regression are retained in `.cache/story-runtime/`; successful later runs supersede rather than erase them.

Before release, qualify the native upload → exact poster → explicit binding → fresh legal win → Play/Skip → first-earned Collection journey, master/cinematic audio controls using an audible fixture, missing-original recovery, explicit portable originals restores, menu focus and cancellation. Ship a usable owned example with precise binding/download instructions. Then verify the complete transitive game-module graph and exact originals in loose/ZIP/offline artifacts and perform the ordinary frozen/public acceptance pipeline. No source version/build change is implied by this integration guide.
