# Couch music: shared-library and context foundation

P02-B adapter milestone only. Team/Versus pages do not use these modules yet. This does not deliver the Music library UI, a new audio session, Team sound effects, offline certification or listening qualification.

## Library ownership

`createCouchMusicLibrary` owns a managed-media connection configured with `storyMedia: true`, matching Solo's v4 database. An explicitly supplied v4 manager remains borrowed. The soundtrack facade reads and commits only the existing audio domain. Database initialization/migration and shared-library writes are intentional; no Solo profile, progress, gameplay state or co-op saves are read or written.

Create the existing persistent player with `readAsset: (hash) => owner.readAsset(hash)`, then create the owner with that player before any load/play. `load()` immediately sets `snapshot().status` to `loading`; `commit()` sets `saving`. Both return `{adopted, saved}`. Render the current snapshot after settlement, including on rejection, because an obsolete operation's failure must not overwrite a newer state. The API does not own DOM, focus, game pause, a scheduler or autoplay.

The owner checks snapshot generation, validates/clones library metadata, checks complete native Blob coverage and sizes, then installs its owned byte map **before** calling `player.setLibrary`. The managed store/prepared-import pipeline remains the persistence/validation boundary; the player independently verifies MP3 frames and hash before playback. This is not a replacement for import preparation, browser decoding, or a complete album decode on startup.

Older reads cannot overwrite a newer operation. Lower generations cannot replace accepted state. Same-generation metadata conflicts fail; an identical generation retains current cached bytes and does not reset a deliberate session selection. Reloading is not an automatic background refresh of unsaved library drafts.

Save requires a loaded generation and a verified prepared library. A second save or reload while saving is refused. Keep the store's expected-generation conflict and quota checks; never silently retry a rejected write. Errors retain previously accepted library bytes and player metadata. A committed store transaction cannot be undone merely because the host closes or refuses subsequent adoption: show recovery and reload, rather than claiming rollback or repeating the write.

Close aborts/fences pending operations, drops owned byte references and closes only the owned connection. Dispose player/panel/published outputs before closing the library owner. Notifications that dispose the host during adoption cannot revive a closed library. A player notification must not throw after partially mutating player state; as elsewhere in the player API, rendering callbacks are host-owned.

## Accepted content identity

`soloCompatibleMusicContext({campaignKey, level, themeId})` uses Solo's existing map key `JSON.stringify([campaignKey, level.id, level.revision, themeId])`. Supply the accepted base campaign/edition identity from catalogue metadata. Do not parse installed execution-key strings or derive identity from visible titles. Solo revisions are strings.

`prepareTeamMusicContext({pack, level, themeId, signal})` snapshots and validates the strict historical pack, verifies that the exact level belongs to it, and hashes canonical pack data. Its campaign key is the JSON tuple `['team-music.v1', version, ruleset, id, revision, sha256]`; its map key adds exact level ID/revision and theme. Team revisions remain numbers. Plain imports and the pack extracted from an already verified presentation envelope use the same computation. Presentation bytes are outside this identity; no music fields are added to Team packs.

Compute Team context during preparation, outside the frame/gesture loop. The helper checks cancellation before and after hashing. **The host must additionally fence obsolete preparations and call `player.setContext` only when the staged attempt is accepted.** A preview, failed Next or abandoned download must not switch an existing run's assignment. Until context is ready, disable only map/campaign assignment actions and explain why; global/theme playlists remain usable.

## Volume and pending integration

Keep shared master mute/volume as the origin-wide authority. Keep the player music fader separate from the library's audition fader. The planned Couch session defaults to Soundscape's 0.55 music level and retains changes only for that page session, unless a separately versioned global music preference is implemented. This foundation does not add that session/fader UI, persist music volume, or write Solo's profile to imitate its settings.

Next slice must compose one existing persistent player per page, use this owner for startup and library refresh/commit, and implement a supported panel pre-adoption hook. The current panel calls `player.setLibrary` before `onLibrary`; **an onLibrary-only guard is too late**. Do not pass this owner off as the existing panel store without an explicit adapter: `load/commit` return adoption results, not the panel's raw snapshot contract.

Then integrate both Couch hosts: Settings → Audio transport/library, top-modal input ownership and exact opener restoration; gesture-time Play; explicit music Pause preserved even before first Start; nonblocking slow startup; continuous menu/pause/results scheduling; suspend/foreground behavior; approved presentation fallback; idempotent disposal. Team gameplay cues remain visual until their separate audio release.

## Verification boundary

New tests cover adoption ordering, generation/race conflicts, invalid/missing originals, cancellation/disposal, a real prepared MP3 through the existing player/master, managed v4 interoperability and independent presentation-domain preservation, plus exact compatible/Team context hashing. Existing player/store/master/connection suites run whole. IndexedDB, AudioContext and media elements are finite models; the reused coded-silence MP3 fixture verifies byte/transport behavior, not audibility. No browser, physical controller, listening, public deployment or complete host journey is claimed by this milestone.
