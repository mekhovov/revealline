# UA-FPV source-preview verification

Date: 2026-09-21. Source: isolated `codex/soundtrack-v3-latest` worktree, working changes after `0fd35c8099c6f06a5c013935451d2f10a0d06a05`. This is a native Codex in-app browser check of the development server at `http://127.0.0.1:18892/game/`, not a frozen build, Pages deployment, physical iPhone test or full musical audition.

The test used the actual Settings → Audio → Music library & playlists controls, native file chooser, bundle validator, additive import and atomic Save. No injected app functions, storage writes or mocked media probes were used.

1. Imported volume 04; Studio reported six custom tracks, one playlist and 19.2 MiB. Save completed at generation 1.
2. Selected its playlist, unmuted and pressed Play. Now Playing reported a supplied title, `playing`, advancing position, full duration and exact original filename. Next selected a different supplied recording. Pause preserved its position.
3. Added and saved volume 01: generation 3, 31 tracks, two playlists, 81.7 MiB. Volume 02: generation 4, 57 tracks, three playlists, 143.8 MiB. Volume 03: generation 5, **80 tracks, four playlists, 205.0 MiB**. Earlier selected music and entries remained present.
4. Selected Ukrainian and saved: generation 6, explicit playlist reset to Automatic, Ukrainian selection retained. Playback selected a recording from another imported volume. Its title appeared in Settings, the main menu and a running Solo level.
5. Reloaded the page. Sound-on intent remained; the first Settings gesture started a saved Ukrainian recording. Studio reported **generation 6, 80 tracks, four playlists and 205.0 MiB**, Ukrainian mode, title and original filename. Paused music intentionally after verification.

All four exact pack files were accepted. The separate native codec receipt verifies all 77 unique recordings; this UI pass played excerpts and transitions from several recordings and does not establish complete listening acceptance of all 77. It does not certify public recording/artwork rights, authentic instrumentation, lyric suitability, Content ID clearance, physical hardware or cold offline restart. The older published v0.76.1 bundle reader cannot import these RLSTB3 packs; the upload guide includes its raw-MP3 fallback.

Private pack bytes remain outside Git and public deployment. The development browser profile holds the local installation; source files and private packs remain the recovery copies.

## Licensed previews in the same local library

After the v2 compatibility repair, reloaded the source page and confirmed generation 6 still held all 80 UA-FPV entries. Added the actual `preview.expansion-metal.rlsound` through the same native file-input/additive-import/Save controls: generation 7, 86 tracks, five playlists, 242.8 MiB. Metal selection saved at generation 8. Playback showed **Abelian · Zander Noriega**, its original MP3 filename, progressing position and the creator-source link `https://opengameart.org/content/abelian`.

Added `preview.expansion-synth90s-cues.rlsound`: generation 9, **90 tracks, six playlists, 249.8 MiB**. 90s Synth selection saved at generation 10. Play showed **Helgi The Hero Bold (Sega-style FM synth mix) · Ragnar Random**, MP3 filename and duration. A later observation, without an intervening Next command, showed **ADN · Snabisch** playing. These are explicitly short cues, not newly claimed full compositions. Music was paused before selecting My Mix for the user's local preview.

The local installation thus includes all 77 unique UA-FPV recordings plus ten distinct licensed preview recordings. Remaining licensed albums are available as the separately verified local upload files described in the music-library guide. They cannot all fit alongside UA-FPV under the shared 256 MiB budget. These observed excerpts and one automatic cue transition do not grant full listening approval or public admission.

Final observed state: **My Mix, paused, generation 11, 90 tracks, six playlists, 249.8 MiB**. The browser error log was empty. The development preview tab remains available for the user to press Play; no autoplay or listening approval is implied by leaving the tab open.
