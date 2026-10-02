# Music in RevealLine

The trusted game catalogue contains **77 recordings**, including the original **70 creator recordings in 15 albums**, the opening theme and six later admissions. Open **Settings → Audio → Music library & playlists**. Under **Pick the music**, choose **Shuffle all music**, a **Music style → Play this style**, or a **Playback playlist → Play this playlist**. These actions save the current draft and start the chosen music; use **Sound controls → Unmute master sound** if muted. The opening theme and existing saved choices are retained. Built-in albums do not consume your custom playlist or upload slots.

To change a built-in album without starting paused music, expand **Offline album downloads** and choose **Save & use album**. To configure **My Mix**, **Installed only**, or **Recording mode**, expand **Filters & custom mix** and choose **Save listening preferences**. Those save actions preserve intentional Pause and master mute; **Play music** starts playback when you are ready.

For a custom sequence, expand **Create playlists**, clone an album, add or remove songs, choose ordered or shuffled playback and a repeat mode, then save. You can mix catalogue songs with your own MP3 uploads. Now Playing shows the audible song, artist, original filename and creator/license websites.

### Visit a song's creator

In editions containing the creator-link follow-up in PR #903, select **Creator
source ↗** beside the current title/artist in Audio, Pause, the music library or
Demo. The song credit in the main-menu footer is itself a link. These links open
the supplied creator page in a new tab and do not start, retry or resume music.
Uploaded originals use their saved source metadata, including during audition;
missing creator metadata leaves plain credits rather than an invented link.
Licence and cultural-provenance links remain separate from creator attribution.
This feature is implemented in the draft PR, not yet claimed publicly released.

## Additional music sources

In a game edition containing the optional-source feature, open **Settings → Audio →
Music sources**. Paste a compatible public catalogue or site URL and select **Add
and load**. For the separately hosted collection, use:

```text
https://mekhovov.github.io/revealline-soundtracks-fpv/
```

This saves and enables the source in this browser; it does not start music or change
mute/volume. Leave the main archive enabled to mix sources, or turn it off to use only
the additional catalogue. Choose styles and **Play selected styles** in Audio, or
search/select a song in the music library. **Mix with the current game and uploaded
music selection** controls whether local selections join that online queue.

The main archive is enabled by default. Additional sources are never added by an
import, a song's credits, a style selection or a game update. Up to four catalogue
sources (including main) and 512 online recordings are supported. Disabling/removing
a source cancels its requests and removes its remote songs from the queue; other
sources, uploaded originals and bundled music remain usable. Removing a source does
not delete personal uploads or installed audio. Source preferences persist separately
from library edits, with their own conflict check; reload after another tab changes them.

Available source styles and collections refresh after loading. Identical audio hashes
are deduplicated across remote sources while preserving their metadata. Conflicting
rights are handled conservatively. Unknown-licence entries are accepted only from an
explicitly added source, retain their honest labels, and do not gain offline installation,
backup/export or Recording-mode permission. Main remains licensed-only.

Compatible sources must serve bounded catalogue-v1 JSON over public HTTPS with CORS.
The game rejects credentials, local/private literal destinations, query tokens and
catalogue redirects, then binds hash-addressed audio paths to the selected source.
Browser URL checks do not pin DNS, and native media requests may follow redirects;
add only sources you trust. Packaged browser previews permit HTTPS catalogue/media
requests; script execution stays self-hosted. Native/self-contained package security
is unchanged. A source that fails cannot disable the other sources.

This is streaming support, not a new licence or admission into standard game albums.
Source choices are browser preferences; existing `.rlsound` imports cannot enable
network sources. Physical iPhone/controller qualification remains separate from
software/browser tests.

## Online and offline listening

Online listening needs no manual file import. Public catalogue recordings stream through the game's owned media element from the exact URL declared by the canonical archive; only the current and next selections are prepared. The original 70 admitted recordings also retain their strict inventory, byte-count and SHA-256 verification path for offline installation. The game never downloads the whole collection merely to browse it.

Expand **Offline album downloads**, choose **Download for offline** on an album, wait for verification, then **Save all changes**. **Installed only** limits playback to locally available music. **Remove offline download**, followed by Save, removes the album's installed copies while retaining playlists and credits. Browser storage can be evicted, so keep backups of personal uploads. Audio shares the existing **256 MiB** media budget with other installed media; the whole 338.5 MiB online collection cannot be installed together. The library allows **123 uploaded tracks and 26 custom playlists**, separately from **256 catalogue entries**. The v3 format allows up to **512 asset/reference entries**; that does not increase the upload slots or byte budget.

Saved-library backups retain personal uploads, installed songs and songs explicitly referenced by custom playlists, selections or assignments. They do not download unused online catalogue songs merely because those songs appear in the browser. That unused catalogue is discovered again in an edition that includes it. Missing permitted originals still fail visibly. Restricted recordings remain explicit reference-only entries, with the existing online-restoration warning. A deliberately selected large mixed playlist can exceed the complete-file limit; export smaller playlists when needed.

## How the repositories connect

The game repository owns the player, playlist UI and a generated catalogue of exact recording identities, hashes, credits, rights and album membership. The canonical [soundtrack repository](https://github.com/mekhovov/revealline-soundtracks) owns the MP3 objects, dynamic catalogue and intake automation and publishes them through [its GitHub Pages site](https://mekhovov.github.io/revealline-soundtracks/). The original 70-track object set is mirrored there for trusted offline-album compatibility; every newer recording uses immutable, SHA-256-named GitHub Release assets.

For the original 70-track offline collection, the game resolves the code-approved canonical URL, verifies its pinned inventory, and fetches only matching `objects/<SHA-256>.mp3` files. Explicit offline installation stores verified bytes in the game's shared IndexedDB database. The larger public catalogue is refreshed from the same canonical repository and streams only validated GitHub Pages or hash-addressed GitHub Release media URLs. Imported credits and URLs cannot authorize a new download host or grant rights.

The admitted compatibility `inventory.json` and its 70 recording URLs are immutable dependencies. Future catalogue additions use new hash-addressed Release assets and become available after a catalogue refresh without a game code change. They do not silently join the trusted offline collection; adding offline installation requires explicit rights and a separately reviewed delivery admission. Preserve existing inventory and object paths so older editions can continue playing their catalogues.

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
