# Licensed community music

This collection contains **30 existing third-party recordings**, not original RevealLine compositions. Recording licenses, exact bytes and codec structure were inspected; musical quality, full listening, loop seams and the in-game mix remain unapproved.

The [source register](sources.json) supplies exact creator credits, source URLs, album membership and source/delivery hashes. The [production register](production-register.json) adds hash-bound permission policies, website links, provisional genre tags, codec inspection and pending reviews. Permission eligibility is separate from musical acceptance. Content ID status is unknown.

| Album | Tracks | Complete bundle bytes |
| --- | ---: | ---: |
| Holizna — Retro Wave 1 | 7 | 52,541,133 |
| Holizna — Retro Wave 2 | 6 | 41,485,046 |
| Rock & Metal | 4 | 24,068,144 |
| 3xBlast — Pop-Punk Chiptune | 7 | 27,157,529 |
| Tracker & FM Arcade | 4 | 18,791,065 |
| Metal — Extra Battles | 2 | 7,146,053 |

All six complete bodies fit below 64 MiB. Combined bundle size is 171,188,970 bytes; distinct runtime MP3s total 171,167,505 bytes. These share the 256 MiB managed-media budget with other content, so individual fit does not guarantee that a particular profile can install all of them.

Nineteen delivery MP3s are exact creator originals. Eleven are documented derivatives of retained OGG recordings: seven historical 3xBlast conversions and four new tracker/FM conversions. New intake is 20,286,781 bytes of exact originals plus 18,787,984 bytes of derivatives, below the 100 MiB acquisition budget. No archive, model, encoder package or temporary PCM was added.

The prior 24 works were reused from commit `52e5d5458174e727e6d48d567ca69dbb3bc9e4a7`. Each binary was checked against SHA-256 and its Git blob before hard-linking into this worktree. Git commits ordinary file contents, not a dependency on another checkout. Do not modify hard-linked binaries in place; a changed delivery copy needs a new path and provenance. [Reuse receipt](provenance/reuse-2026-09-21.json).

The retro additions have specific creator-described production: **Raspberry Jam** uses MilkyTracker/New Jack Swing; **Escalate** uses RADTracker/YMF262; the selected Ragnar Random remixes use Sega-style FM virtual instruments. These are creator claims, not verified hardware authenticity. Holizna remains modern retro/synthwave; 3xBlast remains pop-punk/chiptune fusion. None is described as Ukrainian folk music.

**Escalate** uses CC BY 3.0: retain creator, title, source/license links and the OGG-to-MP3 conversion notice. The other 29 use CC0, with credits retained. [Current primary-page review](provenance/license-revalidation.json) and [3xBlast restriction/correction history](provenance/SOURCE-HISTORY.md) are evidence. The old archive INFO restriction was not silently removed.

- [Download receipt](provenance/additional-downloads.json): official file URLs, verified HTTPS, exact bytes and hashes.
- [Derivative receipt](provenance/additional-derivatives.json): exact parents, encoder identity, source sample rate/channel preservation and complete source/output decode durations.
- [Frame inspection](provenance/runtime-frame-inspection.json): all 30 pass the game's structural MP3 scanner; not a listening approval.
- [Album receipt](provenance/album-build-receipt.json): complete in-memory bundle hashes/sizes; duplicate generated bundles were not retained.

`buildSoundtrackAlbums()` in [build.mjs](build.mjs) validates bounded paths, hashes, license evidence, derivative lineage, MP3 frames and album ownership, returning `{ catalog, bundles }`. It never fetches or encodes. Distribution can also use pinned individual runtime paths. Optional CLI output must be a new directory under this checkout's `.cache`:

```sh
node authoring/library/licensed-audio/build.mjs --output .cache/NEW_OUTPUT
```

Encoder scripts are authoring evidence, not automatic build hooks. Raw sources stay outside automatic game includes. Restricted stock candidates and local Ukrainian references are separate and excluded from this producer.
