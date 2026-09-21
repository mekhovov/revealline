# Licensed community music

This collection contains **70 third-party recordings in 15 optional albums**, not original RevealLine compositions. Recording licenses, exact bytes and codec structure were inspected; musical quality, full listening, loop seams and the in-game mix remain unapproved. All 70 are candidates, with **zero listening approvals** and an unchanged, empty [publication list](publication.json). The nine new albums are labelled **Preview**.

The [source register](sources.json) supplies exact creator credits, source URLs, filenames, album membership, source/delivery hashes and provisional style metadata. The [production register](production-register.json) adds hash-bound permission policies, website links, codec inspection and pending reviews. Permission eligibility is separate from musical acceptance. Content ID status is unknown. No recording in this collection is claimed to be Ukrainian music; separately cleared Ukrainian references and original-production candidates retain their own review gates.

| Album                                     | Tracks | Runtime MP3 payload bytes |
| ----------------------------------------- | -----: | ------------------------: |
| Holizna — Retro Wave 1                    |      7 |                52,536,475 |
| Holizna — Retro Wave 2                    |      6 |                41,480,910 |
| Rock & Metal                              |      4 |                24,065,375 |
| 3xBlast — Pop-Punk Chiptune               |      7 |                27,152,297 |
| Tracker & FM Arcade                       |      4 |                18,787,984 |
| Metal — Extra Battles                     |      2 |                 7,144,464 |
| Metal & Synth-Metal — Preview             |      6 |                39,694,027 |
| Instrumental Rock — Preview               |      3 |                25,967,554 |
| Electronic & Dance — Preview              |     10 |                52,316,634 |
| 90s Synth & FM — Preview                  |      4 |                28,213,503 |
| 90s Synth & FM — Short Cues — Preview     |      4 |                 7,289,105 |
| Fakebit & Chiptune — Short Cues — Preview |      7 |                11,561,709 |
| Fakebit & Chiptune — Preview              |      4 |                13,341,255 |
| Ambient — Short Cues — Preview            |      1 |                 2,861,038 |
| Electronic & Dance — Short Cues — Preview |      1 |                 2,573,792 |

Each album's raw payload is below 60 MiB, reserving at least 4 MiB within the 64 MiB complete-bundle limit for metadata and framing. Final bundle validation remains the compiler's responsibility; these are payload sizes, not new bundle-size receipts. Distinct runtime MP3s total **354,986,122 bytes (338.54 MiB)**. They share the **256 MiB** managed-media budget with other content, so all 70 cannot be installed in one profile simultaneously.

Thirty-seven delivery MP3s are exact creator originals. Thirty-three are documented derivatives of retained OGG recordings: seven historical 3xBlast conversions, four earlier tracker/FM conversions and 22 expansion conversions. The current 40-track expansion retains **205,788,076 bytes of originals plus 76,779,926 bytes of derivatives**, or 269.48 MiB, below its 300 MiB retained-source-and-delivery budget. Temporary ZIPs were hashed and selected MP3 members identified before disposal; WAV members were not retained. No model or sample library was downloaded for this intake.

The new 40 have **5,337.193832 seconds (88:57.194)** of complete native-decoded MP3 audio: 18 creator MP3s and 22 delivery derivatives. Thirteen are under 90 seconds and occupy explicitly labelled short-cue albums; 27 are at least 90 seconds. Duration does not establish that a work has a full-song structure or is musically approved. The older six albums retain their identities and membership, including five older short cues. All 70 total **10,043.915265 seconds (2:47:23.915)** by MPEG-frame inspection, including encoder padding; that whole-library figure is not a new full-listening or native-decode claim.

The prior 24 works were reused from commit `52e5d5458174e727e6d48d567ca69dbb3bc9e4a7`. Each binary was checked against SHA-256 and its Git blob before hard-linking into this worktree. Git commits ordinary file contents, not a dependency on another checkout. Do not modify hard-linked binaries in place; a changed delivery copy needs a new path and provenance. [Reuse receipt](provenance/reuse-2026-09-21.json).

Style selection follows creator descriptions. The primary mappings are 24 electronic, 18 chiptune, 12 metal, 12 90s synth/FM, three rock and one ambient. Holizna's modern synthwave is **electronic**; 3xBlast's pop-punk/chiptune is primarily **chiptune**, with rock retained as secondary source evidence. **Raspberry Jam** uses MilkyTracker/New Jack Swing; **Escalate** uses RADTracker/YMF262; **The Demon King** uses BambooTracker/YM2608; selected Ragnar Random remixes use Sega-style FM virtual instruments. These are creator production claims, not verified hardware authenticity.

New guitar selections include Zander Noriega's creator-described heavy/thrash tracks and Peachtea's synth-metal. Stonemason, Ironbound and Blinding Lights are primarily rock, not advertised as extreme metal. Electronic variety includes creator-described funk, dance, drum-and-bass, techno and jazz-inflected material. Richer secondary descriptions stay in authoring evidence. Only The Demon King and Last Stand [Let's Go] receive two runtime genre tags, reflecting their explicit cross-style descriptions; generic secondary labels do not automatically enter Fusion. Most roles are `any`; energy 3 is neutral, and higher values are provisional mappings from explicit creator descriptions, not audition scores.

Fifty-five recordings use CC0, twelve use CC BY 3.0 and three use CC BY 4.0. Retain title, creator, source/license links and conversion notices for attributed works; credits are retained for CC0 too. [Primary-page reviews](provenance/license-revalidation.json) preserve the earlier checks and add the 24 creator pages covering this expansion. Published grants support commercial game use, offline copies and redistribution; they do not establish Content ID registration status or independently verify every underlying sample. Ragnar Random discloses virtual chip emulation and drum-machine samples without an individual sample inventory. No explicit third-party cover or restrictive term was found in the reviewed pages. The [3xBlast restriction/correction history](provenance/SOURCE-HISTORY.md) remains intact; the old archive INFO restriction was not silently removed.

For private review, open **Music Studio → Community soundtracks**, add selected available albums, then **Save**. Listen and assess the candidates before approving them for publication. Use the style choices or My Mix for genre selection, or create a personal playlist from selected tracks; imported album playlists shuffle and repeat. Turn sound on to allow menu music, subject to the browser's first-interaction requirement. Pausing music preserves sound effects.

To reclaim storage, use **Remove offline download** for an installed album and save. Track identities, credits and playlist references remain; **Download again** restores available declared bytes explicitly. Bytes still required by separate personal uploads remain stored. Offloaded tracks are skipped rather than silently re-downloading an album. Restore required downloads before preparing a complete backup or transferable file. Website links and original filenames help identify recordings; a filename is not a rights grant.

- [Download receipt](provenance/additional-downloads.json): official file URLs, verified HTTPS, exact bytes and hashes.
- [Derivative receipt](provenance/additional-derivatives.json): exact parents, encoder identity, source sample rate/channel preservation and complete source/output decode durations.
- [Frame inspection](provenance/runtime-frame-inspection.json): all 30 pass the game's structural MP3 scanner; not a listening approval.
- [Album receipt](provenance/album-build-receipt.json): complete in-memory bundle hashes/sizes; duplicate generated bundles were not retained.
- [Expansion source research](../../../docs/research/licensed-music-expansion-2026-09-21/README.md): creator pages, attachment declarations and conservative style evidence.
- [Expansion download receipt](provenance/expansion-downloads.json): 40 exact originals; ZIP hash, member name and CRC where applicable.
- [Expansion MP3 decode receipt](provenance/expansion-mp3-decode.json): 18 full decodes, native rate/channel preservation, source hashes unchanged before/after.
- [Expansion derivative receipt](provenance/expansion-derivatives.json): 22 full OGG and MP3 decodes, pinned encoder and source/output hashes, no trim or gain changes.

The first four receipts above describe the earlier 30-track state and are retained as historical evidence; they are not relabelled as 70-track results. All new 40 also passed the game's complete MPEG-frame scanner during metadata reconciliation. This is technical validation, not musical listening.

`buildSoundtrackAlbums()` in [build.mjs](build.mjs) validates bounded paths, hashes, license evidence, derivative lineage, MP3 frames and album ownership, returning `{ catalog, bundles }`. It never fetches or encodes. Distribution can also use pinned individual runtime paths. Optional CLI output must be a new directory under this checkout's `.cache`:

```sh
node authoring/library/licensed-audio/build.mjs --output .cache/NEW_OUTPUT
```

Encoder scripts are authoring evidence, not automatic build hooks. Raw sources stay outside automatic game includes. Restricted stock candidates and local Ukrainian references are separate and excluded from this producer.

To reproduce the metadata reconciliation from the retained research and completed receipts, run `node authoring/library/licensed-audio/provenance/register-expansion.mjs`. It verifies exact retained source/runtime hashes and MP3 frames, preserves the older six albums and review evidence, and updates only the three metadata registers. It performs no download, decode, encode, playback or publication. Format generated JSON with the repository formatter afterwards.
