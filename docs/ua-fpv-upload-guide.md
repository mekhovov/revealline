# UA-FPV private upload packs

The local collection contains **80 supplied filenames and 77 distinct MP3 recordings**. Four private `.rlsound` volumes make every filename available in Music Studio while storing each identical recording only once. Each volume has a shuffle playlist with **Repeat all** and one entry per distinct recording. No MP3 is converted, retagged, trimmed, or replaced.

These are personal local imports, not publicly downloadable licensed albums. The source inventory has no verified recording-specific website links or redistribution permissions. Pack metadata therefore leaves artist, license, and source URL blank and keeps rights as **personal**. Original embedded MP3 tags and artwork remain byte-for-byte intact. The builder does not admit music to the public catalogue or approve its use in recorded gameplay. It does not generate music.

Do not pass this folder to `intake/add-music.mjs` using only a YouTube URL. That
public-archive launcher requires recording-specific public MP3 redistribution
and web-game playback permission, accepts no more than 20 MP3s per batch, and
does not treat a video page as licence evidence. Use the private pack command
below until each recording has suitable permission.

The game-root launcher accepts `--license unknown` as an explicit private mode:

```sh
node intake/add-music.mjs "/absolute/path/to/docs/research/dah-soundtracks" \
  --license unknown \
  --private-output "/absolute/path/to/new-empty-private-directory"
```

This runs the same private builder documented below. It cannot open a public PR
or confirm public rights, and it does not publish the source MP3s. Public
catalogue fields such as `--source`, `--artist`, `--description` and `--styles`
are intentionally rejected in unknown-rights mode because private packs preserve
the original filenames and embedded tags without making public metadata or
rights claims.

## Compatibility: packs need the new soundtrack framework

These four files use **RLSTB3 / soundtrack library v3** and work with **v0.78.0 and later**, which contain the framework introduced in PR #209. The older **v0.77.0** source (`432110b51c570b838cdae390790b67dfa76f0785`), like the earlier v0.76.1 base, accepts **RLSTB1 only**. It cannot import these four packs, and renaming the files or changing their header will not convert them. In the current Music Studio, expand **Backups & album files** to find **Add album file to draft**, and **Filters & custom mix** to find **Music selection → My Mix**. The older studio has **Complete soundtrack backup (.rlsound)** and only replacement-backup import.

### Play the source MP3s in v0.77.0 or v0.76.1

You can use the original MP3 files directly without creating another audio copy or waiting for the new pack importer:

1. Open **Settings → Audio → Music library & playlists**. If there is existing music, prepare and download its saved-library `.rlsound` backup first.
2. In **Add MP3 files**, select the original files from the main checkout's `/Users/oleksandr.mekhovov/work/my_projects/go_test/docs/research/dah-soundtracks/` folder, outside this isolated soundtrack worktree. Choose **Import selected MP3s**, wait for inspection, and **Save all changes**. You may use smaller batches and Save after each. Import each filename once: this older path creates new track IDs on every import, so repeating a batch creates duplicate library rows.
3. Leave **Source declaration** as **Personal local upload**. The old importer uses the original filename for **Track title** (up to 120 characters) and keeps the complete filename in **Source / provenance**. It has no separate preserved-filename field; retain the source folder and index before editing provenance. MP3 bytes and embedded tags remain unchanged, and identical audio shares one stored hash.
4. Select an imported song in **Tracks**, then click **New playlist with selected track**. Set a title, choose **Shuffle without repeats until every entry played** and **Repeat all**, then **Apply playlist details to draft**. Add the remaining songs through **Track to add → Add selected track** and **Save all changes**. The playlist can hold all 80 entries; use the index's 77 `queued: true` filenames if you want each distinct recording only once.
5. Choose that custom playlist in **Playback playlist**, click **Save & use playlist**, use **Unmute master sound** if muted, and press **Play music**. **Next** advances through the playlist. To mix styles on this older edition, manually add other imported tracks or built-in synth tracks to the same custom playlist.

These older editions do not have genre-wide **Ukrainian**, **My mix**, **Installed only**, **Recording mode**, additive pack import, or the new menu/transition behavior. Their **128 total track / 32 total playlist** limits include the five built-in tracks and six built-in playlists, leaving **123 custom tracks and 26 custom playlists**. The 256 MiB shared budget still applies. All 80 files fit only if the existing library and other managed media leave enough room. Native decoding on the particular browser/device is still required; raw import is not listening or rights approval.

A v1 saved-library backup from the old edition can be imported by the new framework. A v3 backup is not backward-compatible with that old reader. The new framework also uses a newer shared storage boundary: use a separate origin/profile for a preview and keep your old backup before adopting a newer release rather than switching an upgraded store back to the old edition.

## Get or reproduce the private packs

An already generated set is in `.cache/ua-fpv-local-packs-2026-09-21/` in the soundtrack worktree. Keep these files private. The game deployment, Git history, and public download catalogue must not include them without separate verified permission.

From the repository root, with the current supported Node version:

```sh
node scripts/ua-fpv-local-pack.mjs \
  --source-dir /absolute/path/to/docs/research/dah-soundtracks \
  --output-dir /absolute/path/to/new-empty-private-directory
```

Both paths are explicit. The output must be empty and outside the original source folder; existing files are never overwritten. Before writing any output, the builder budgets every encoded volume and the full JSON index, rounds up filesystem blocks, allows 1 MiB for directory overhead, and requires a further **1 GiB free-disk reserve**. It rechecks the remaining output before each write and refuses when space is insufficient; there is no command-line override. The builder reads the immediate MP3 files, rejects symlinks and invalid audio, and stops on an unsupported file instead of silently omitting or converting it. It writes four `.rlsound` files and `ua-fpv-local-index.json` for this collection. The JSON records every exact filename, track ID, original byte count, SHA-256, duplicate alias, volume, and canonical playlist entry. It is an index, not another game import format.

For the supplied source set:

| File                      |    Import bytes | Track names | Distinct recordings |
| ------------------------- | --------------: | ----------: | ------------------: |
| `ua-fpv-local-01.rlsound` |      65,564,765 |          25 |                  24 |
| `ua-fpv-local-02.rlsound` |      65,099,593 |          26 |                  24 |
| `ua-fpv-local-03.rlsound` |      64,238,488 |          23 |                  23 |
| `ua-fpv-local-04.rlsound` |      20,125,425 |           6 |                   6 |
| **All volumes**           | **215,028,271** |      **80** |              **77** |

Every volume is below the **64 MiB** optional-album target, including its manifest. Volume 04 is the smallest choice for a first import. Its contents are a subset of the complete collection; import all four for all supplied files.

## Import without replacing your existing music

The packs require **v0.78.0 or later**, as described above. The steps below use the simplified controls introduced in **v0.81.0**. In v0.78.0–v0.80.x, **Save & use playlist** and **Save & use music selection** are the older selection buttons; they preserve Pause, so use **Play music** separately. Use the browser profile or native host where you want the music saved. Browser profiles, private windows, origins, and native apps may have separate local libraries.

1. Open **Settings → Audio → Music library & playlists** in Solo, or the **Music library** from the Couch audio controls.
2. Expand **Backups & album files**. If you already have music, use **Prepare saved-library backup (.rlsound)**, then **Download prepared backup**. Save any current draft first if you want it included. Keep the source MP3 folder separately too.
3. In **Soundtrack recovery or album file (.rlsound)**, choose one volume.
4. Click **Add album file to draft** and wait for validation. This adds tracks and its playlist while preserving the current selection and assignments. **Review backup as replacement draft** is for replacing a library, so do not use it to add these volumes.
5. Click **Save all changes** and wait for the saved status. Repeat the file selection, additive import, and Save for the remaining volumes. Saving each volume makes progress durable before importing the next.
6. Under **Pick the music**, choose **UA-FPV · Local volume 01**, **02**, **03**, or **04** in **Playback playlist** and click **Play this playlist**. This saves the draft and starts the selected playlist. Use **Sound controls → Unmute master sound** if muted; browser audio may need an explicit gesture.

The supplied playlists use shuffle without repeated entries until each entry has played, then repeat indefinitely. Volume playlists contain only their own recordings; they do not automatically advance into the next volume. Reimporting the same unchanged pack is idempotent. If you edit an imported track or playlist and later reimport that volume, the identity conflict protects your edited version; keep a backup rather than replacing it accidentally.

## Play the whole collection or mix styles

After all four volumes are saved, choose **Ukrainian** in **Music style**, then **Play this style**. This saves the draft, clears the explicit playback-playlist choice and starts a repeating shuffled selection of eligible Ukrainian-tagged tracks, including the imported UA-FPV collection. These local tracks are tagged for both menu and gameplay. Selecting a genre is not a review of the recordings' cultural accuracy or rights.

For a mix with other installed or available music, expand **Filters & custom mix**, select **Music selection → My Mix**, enable the desired genre checkboxes, and click **Save listening preferences**. This saves the draft and clears the explicit playlist choice while preserving Pause; press **Play music** when ready. **Installed only** limits selection to audio available locally. Leave **Recording mode** off for these unverified personal files: their gameplay-video permission and Content ID status are unknown, so that filter excludes them.

The three exact-byte duplicates retain both filename identities so all 80 names remain selectable. The four supplied volume playlists queue each recording only once. In **v0.80.0**, genre-wide selections and My mix also deduplicate identical recordings by hash, so you can keep all 80 filename rows without replaying their three aliases as additional songs. Custom playlists preserve their explicit entries, including deliberate repeats. In v0.78.0 and v0.79.x, use the four supplied playlists or build one from the index's 77 `queued: true` entries to avoid alias repeats. Retain the index and all original files so no filename provenance is lost.

To make your own playlist, expand **Add & edit music** and select a track in **Tracks**. Expand **Create playlists**, click **New playlist with selected track**, set **Playlist title**, **Playback order**, and **Repeat**, then click **Apply playlist details to draft**. Use **Track to add → Add selected track** for further entries, adjust entry order if desired, and **Save all changes**. Choose it in **Playback playlist** and use **Play this playlist**. A playlist supports up to 128 entries. The JSON index's canonical entries (`queued: true`) identify the 77 distinct recordings if you build one combined playlist manually.

## Capacity and preserving originals

- Importing all four volumes needs **80 of 123 custom track slots** and **4 of 26 custom playlist slots**, leaving 43 and 22 respectively in an otherwise empty library. Trusted built-in catalogue entries have a separate **256-entry capacity** and do not use those custom slots; the v3 asset/reference envelope is **512 entries**, still within the shared byte budget.
- The originals use **214,952,083 bytes (about 205.0 MiB)** of the **256 MiB shared media budget**. Only **53,483,373 bytes (about 51.0 MiB)** remain for other managed audio, images, chapters, and staging from an otherwise empty store. Existing media reduces that headroom. MP3 alias bytes are deduplicated by SHA-256.
- The four bundle files include manifests, so their download size is slightly larger than their stored original audio. Each individual supplied MP3 is below the 32 MiB/12-minute track limits.
- If Save reports capacity or a concurrent-writer conflict, follow that message and keep the previously saved library. Back up before removing anything. The builder cannot know or reserve space in your browser's existing shared store.
- Keep the original 80-file folder and private `.rlsound` files outside browser storage. Browser site-data deletion, a different origin/profile, or storage eviction can remove the installed copies. Local installation is not an independent backup.
- **Prepare selected playlist as album** requires declared sharing permission and deliberately rejects these personal imports. The local pack builder and private recovery files do not grant public redistribution rights. Use a private saved-library backup for personal recovery; do not relabel unknown recordings as licensed to enable sharing.

## Verification boundary

The builder checks every file with the game's MP3 inspector, exports native binary **RLSTB3** bundles, reimports each through the current bundle importer with an explicitly structural media probe, and merges every volume through the actual additive-share function. It verifies filename and distinct-original counts and records bundle hashes. The builder itself establishes format and byte preservation, not native decoding.

A separate macOS technical pass completed full native decoding of **all 77 distinct recordings** with `/usr/bin/afconvert` into temporary 16-bit PCM WAV files. Every output retained **44,100 Hz / two channels**, and every decoded frame count exactly matched CoreAudio's expected valid frames. All decodes exited successfully with no decoder stderr. All 80 supplied original hashes were verified before and after. Scratch was limited to one recording at a time (maximum **54,439,936 bytes**) and removed afterward. The private receipt is `.cache/ua-fpv-local-packs-2026-09-21/decode-check.json`, SHA-256 `07e71b7dcd4d139f75dd83a73dc9ccc80764198eb1e97757c069601ea5b69e93`.

Browser verification is a separate check: the isolated native UI pass additively imported and saved **all four volumes: 80 track rows, four playlists, and about 205 MiB of original audio**. The library reached saved generation 5; selecting **Ukrainian** saved generation 6 and played a recording from another volume. **Play** and **Next** showed the song title and preserved filename, and the same current title appeared in the main menu and a running level. This verifies the observed import, Save, selection, and transport paths; it does not claim all 77 recordings were listened to or played to completion in the browser. Actual Studio import runs that host's native media probe; check your chosen installation and playback controls in the intended browser/device.

Technical decoding and browser transport checks do **not** approve musical quality, subjective listening, ownership, lyrics, artwork rights, or recording-safe use.

The source set has three duplicate pairs with conflicting filename descriptions. Those aliases are preserved as supplied, not treated as independently verified song titles or artist credits. Distinct recordings with similar names remain distinct by SHA-256.

## Source follow-up — 21 September 2026

The user supplied [the Телебачення Торонто video with Ницо Потворно](https://www.youtube.com/watch?v=5tgI33haI4w). Its title, credited channel and approximate duration identify a candidate for **one of 77 recordings**, represented by **two of 80 filename rows**. Embedded metadata does not authenticate the local audio against the video; no source URL or video ID is embedded, and the tag year differs from the video's publication year. The local aliases and original bytes remain unchanged.

The expanded description and channel About review found no Creative Commons label or express game-use/public-MP3 permission. The license remains **unverified**; missing visible licensing information does not establish a confirmed Standard YouTube license. No redistribution grant is inferred, and the other 76 recordings need their own evidence. The retained source check and unsent Ukrainian permission-request draft are local in `.cache/ua-fpv-source-review-2026-09-21/`. No message was sent and no audio was downloaded for that review. See the [publication follow-up](verification/music-publication-2026-09-21/publication.md#ua-fpv-source-follow-up--21-september-2026).
