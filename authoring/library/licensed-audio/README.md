# Community soundtrack sources

This collection contains 24 licensed works in four playlists. Seventeen runtime MP3s are exact creator originals; seven MP3s are recorded derivatives of the retained 3xBlast OGG masters. These are existing third-party compositions. Complete decode/frame checks are separate from native import, listening, loudness, mix and loop-seam acceptance.

| Album                       | Tracks | Complete `.rlsound` bytes |
| --------------------------- | -----: | ------------------------: |
| Holizna — Retro Wave 1      |      7 |                52,541,133 |
| Holizna — Retro Wave 2      |      6 |                41,485,046 |
| Rock & Metal                |      4 |                24,068,144 |
| 3xBlast — Pop-Punk Chiptune |      7 |                27,157,529 |

All four complete bodies are below 64 MiB. Their total is 145,251,852 bytes; distinct runtime MP3s total 145,235,057 bytes. The two Holizna bundles reproduce the earlier checked candidates byte for byte. Source originals total 169,871,097 bytes, and the seven accepted derivatives add 27,152,297 bytes to the authoring source tree. No encoder, wheel, installed package or PCM is included.

The finite [source register](./sources.json) binds creator credits, stable IDs, each original and its runtime body. The [source history](./provenance/SOURCE-HISTORY.md) preserves the 3xBlast archive's stale restriction and the creator's public removal. The [derivative receipt](./provenance/derivatives.json) records the exact OGG parent, MP3 output, full decode durations, encoder wheel SHA and recipe: 44.1 kHz stereo, 256 kb/s, quality 2; no trim, gain, normalization, fade or remix. The historical encoding script retains its original cache paths and is evidence, not a build hook. Source filenames preserve original spelling. “Looped” in a filename is not a seamless MP3 playback claim.

To verify all source bodies and produce new optional outputs from the repository root:

```sh
mkdir -p .cache
node authoring/library/licensed-audio/build.mjs --output .cache/community-albums-check
```

The output directory must be new, beneath this checkout's `.cache`, with ordinary ancestors. The compiler refuses changed original hashes, mismatched derivative lineage, invalid MP3 frames, foreign ownership, oversized albums, symlinks and existing destinations. It never fetches, encodes or installs media. It writes `catalog.json` plus four `optional/soundtracks/*.rlsound` files. A release build checks the generated catalog against [the committed runtime catalog](../../../game/content/optional-soundtracks.json) and checks each complete body against that catalog before staging.

`soundtrackAlbums` is an explicit build opt-in. The small catalog/UI code is core content; all binary music is excluded from core precache and legacy `optionalPacks` JSON metadata. Source originals, provenance and derivatives remain authoring inputs outside automatic game includes. Absent opt-in does not read this producer or emit its bodies.

In Studio, **Browse optional albums** fetches descriptions only. **Add to draft** downloads and verifies the chosen body, preserves existing applied and unapplied draft edits, and adds its playlist/tracks without changing current playback or selection. Preview a selected track with the existing audition controls; **Save all changes** commits the complete union through existing generation checks. **Save & use playlist** is a separate explicit playback choice. The existing complete-backup import remains a replacement operation.

The 256 MiB manager budget is shared with pictures, stories and staging. Four albums fitting individually does not guarantee space in every profile. Quota or stale-generation refusal preserves existing media. No automatic deletion, selection, map assignment or playback occurs when adding an album. Cancel waits for owned network/media work; a noncooperative network has a bounded cleanup refusal and a retained late-body disposer. The user is told if cleanup could not finish within that bound.

The source implementation is an independent milestone after the Couch branch. It does not place audio into the Couch 0.38 release or add a Couch MP3 player. Native whole-collection import/playback and final full distribution qualification remain separate from the focused source tests.
