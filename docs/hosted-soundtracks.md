# Music in RevealLine

The game includes **70 creator recordings in 15 built-in albums**. Open **Settings → Audio → Music library & playlists**. Under **Pick the music**, choose **Shuffle all music**, a **Music style → Play this style**, or a **Playback playlist → Play this playlist**. These actions save the current draft and start the chosen music; use **Sound controls → Unmute master sound** if muted. Fresh libraries start with **90s Synth**; existing saved choices are retained. Built-in albums do not consume your custom playlist or upload slots.

To change a built-in album without starting paused music, expand **Offline album downloads** and choose **Save & use album**. To configure **My Mix**, **Installed only**, or **Recording mode**, expand **Filters & custom mix** and choose **Save listening preferences**. Those save actions preserve intentional Pause and master mute; **Play music** starts playback when you are ready.

For a custom sequence, expand **Create playlists**, clone an album, add or remove songs, choose ordered or shuffled playback and a repeat mode, then save. You can mix catalogue songs with your own MP3 uploads. Now Playing shows the audible song, artist, original filename and creator/license websites.

## Online and offline listening

Online listening needs no manual file import. The game fetches and verifies the selected recording before playback, and prepares at most the next recording. It does not fetch the whole collection. Loading an MP3 completely before playback lets the game verify its exact hash and MPEG structure; this is not progressive streaming.

Expand **Offline album downloads**, choose **Download for offline** on an album, wait for verification, then **Save all changes**. **Installed only** limits playback to locally available music. **Remove offline download**, followed by Save, removes the album's installed copies while retaining playlists and credits. Browser storage can be evicted, so keep backups of personal uploads. Audio shares the existing **256 MiB** media budget with other installed media; the whole 338.5 MiB online collection cannot be installed together. The library allows **123 uploaded tracks and 26 custom playlists**, separately from **256 catalogue entries**. The v3 format allows up to **512 asset/reference entries**; that does not increase the upload slots or byte budget.

Saved-library backups retain personal uploads, installed songs and songs explicitly referenced by custom playlists, selections or assignments. They do not download unused online catalogue songs merely because those songs appear in the browser. That unused catalogue is discovered again in an edition that includes it. Missing permitted originals still fail visibly. Restricted recordings remain explicit reference-only entries, with the existing online-restoration warning. A deliberately selected large mixed playlist can exceed the complete-file limit; export smaller playlists when needed.

## How the repositories connect

The game repository owns the player, playlist UI and a generated catalogue of exact recording identities, hashes, credits, rights and album membership. The [soundtrack repository](https://github.com/mekhovov/revealline-soundtracks-01) owns the MP3 objects and publishes them through [its GitHub Pages site](https://mekhovov.github.io/revealline-soundtracks-01/).

The game resolves a code-approved archive URL, verifies its pinned inventory, and fetches only matching `objects/<SHA-256>.mp3` files. Online playback uses temporary browser object URLs. Explicit offline installation stores verified bytes in the game's shared IndexedDB database. Imported credits and URLs cannot authorize a new download host or grant rights.

The admitted archive's `inventory.json` and recording URLs are immutable dependencies of this edition. Future additions need a separately versioned archive admission with a distinct base URL or path prefix and a new inventory pin; preserve the existing inventory and objects so older editions can continue playing their catalogues.

The archive is part of the game's delivery system. Players use it through the game; they do not need to browse the repository, download an MP3 manually or import an album first. Keeping optional MP3s in a separate repository avoids adding hundreds of megabytes to every game source checkout, release build and core offline cache. A normal game update can change UI and rules without republishing identical audio.

## Recording and review status

These recordings retain audited CC0/CC BY rights, attribution and conversion notices. Musical suitability and full listening review remain pending; technical playback tests do not approve compositions. Content ID status remains unknown, so Recording mode excludes these songs, including auditions. No guarantee against automated claims is made.

AI original production remains paused. This admission does not publish UA-FPV recordings; local upload/share packs and their separate rights-review status remain unchanged.

## Design references

- [MDN: `play()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play): use actual playback promise results and preserve explicit user gestures.
- [MDN: autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay): remembered intent does not override browser playback restrictions.
- [web.dev: media preload](https://web.dev/articles/fast-playback-with-preload): keep preparation selective and respect bandwidth rather than preloading every recording.
- [MDN: storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria): offline storage is bounded and not a replacement for user backups.

Source compilation reads small pinned metadata and previous exact delivery evidence. It never downloads MP3s, invents listening approval or requires local copies of the hosted recordings.
