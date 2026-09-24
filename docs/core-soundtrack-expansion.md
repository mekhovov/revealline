# Core soundtrack expansion — 24 September 2026

## Delivery order and baseline

The approved priority is stronger 90s retro and heavier metal, with Ukrainian
admission research running in parallel. Publish each fully cleared batch without
waiting for the other family. AI original production remains paused at 0/36
approved recordings. Do not count prompts, scores or rejected candidates.

At source `71a0ffeaeb5079ac6e87a7d80327c6b34948aaa3`, the game already includes 70
rights-audited hosted recordings in 15 albums, simplified player controls, the
fresh-profile synth default, upload/custom playlists and offline albums. Full
listening acceptance of these 70 remains separate. Their inventory and saved
identities must not be rewritten when adding music. Ukrainian hosted recordings:
zero. Private UA-FPV packs preserve 80 filenames and 77 distinct recordings.

## Completed engineering

- Draft game PR #321 adds exact-hash reviewed-batch admission without changing the current 70 tracks or 15 albums.
- Immutable `/batches/<id>/` archive bases are supported while preserving existing root archive URLs.
- 77 focused tests passed; an independent review found no concrete defect and reran 39 relevant tests successfully.
- Hosted audio preparation preserves native sources and derives 256 kbps MP3s with full decoding and encoded loudness/peak measurements.

These are engineering results, not listening approval or a released music batch.

## In progress

| Batch         | Candidate count | Current boundary                                                                                                                                                                                                                                                                       |
| ------------- | --------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heavier metal |               6 | Four additional Vitalezzz tracks, Bogart VGM's German Industrial Metal and MintoDog's Heavy Boss Battle 1. Individual CC0/CC BY source downloads selected; all six passed hosted full decoding, MP3 inspection and loudness checks; listening remains pending.                         |
| Retro arcade  |               7 | Unused Ragnar Random compositions selected after comparison against all 70 current entries. Source descriptions cover SID, Genesis/FM and NES-like instruments; seven passed technical checks. Most are short arcade cues; instrumentation and arrangement remain listening questions. |
| Ukrainian     |         4 leads | Alexander Nakarada's CC BY 4.0 Shchedryk/metal adaptation, two Oleg Mazur arrangements and Mark Wilson X's short fusion cue. Exact recording acquisition, applicable licence, listening and cultural review remain open.                                                               |

The candidate counts are not released or approved counts. Hosted preparation
retains native source files, licence-page snapshots, hashes, complete decoder
results, game MP3 inspection, tool versions and encoded loudness/peak results.
The archive intake is outside Pages staging. Local disk is below the 1 GiB
reserve, so no local audio acquisition, rendering or release build is attempted.

## Ukrainian decisions and source evidence

- [Oleg Mazur — Ой у лузі червона калина](https://soundcloud.com/fm_freemusic/oy-u-luz-chervona-kalina-the-red-viburnum-in-the-meadow-ukrainian-patriotic-march-by-oleg-mazur): creator page marks CC-BY and permits sharing, modification and commercial use. Obtain the exact file through the creator's linked authorised download and preserve the licence version. Instrumental status, arrangement provenance and gameplay fit remain unverified.
- [Oleg Mazur — Боже великий, єдиний / Prayer for Ukraine](https://soundcloud.com/fm_freemusic/bozhe-velikiy-diniy-prayer-for-ukraine-spiritual-anthem-of-ukraine-by-oleg-mazur): same creator-origin permission lead; candidate for solemn menu/reflection use. Do not classify it as energetic combat music from its title.
- [Mark Wilson X — Carol of the Bells](https://soundcloud.com/mark-wilson-x/carol-of-the-bells-royalty-free-cc-by): CC BY 4.0 creator statement; FMA identifies an instrumental recording of about 1:21. Treat it as a short Shchedryk/metal fusion cue, not a full-length original or a traditional regional performance. Verify the exact recording and arrangement before admission.
- [Hutsul Havoc](https://pixabay.com/music/main-title-hutsul-havoc-ethno-action-ukrainian-soundtrack-192015/), [Hutsul Fantasy](https://pixabay.com/music/folk-hutsul-fantasy-132797/) and bandura candidates remain excluded from the standalone MP3 archive under Pixabay's standalone-distribution restriction. Hutsul Fantasy is currently credited to `_Music_for_Creators_`, not Rockot. Separate recording-specific permission would be required.
- Holizna's title **Ukraine** does not establish Ukrainian musical motifs. Do not fill this collection with generically tagged music.
- UA-FPV possession and YouTube availability do not establish public redistribution permission. Reuse the existing private packs and guide; no creator has been contacted by this work.

The Oleg Mazur Hypeddit download currently asks the visitor to connect SoundCloud
and comment, like, repost and follow before downloading. No such social actions
are authorized or performed by this work. A freely accessible creator download
or an independently supplied authorized original is still needed. FMA's Mark
Wilson X page returned HTTP 403 through the research reader; the recording has
not been acquired.

### Documented Ukrainian classical fallback — held

These six Mykola Lysenko piano recordings have recording-specific CC BY-SA 3.0
permission from the Lviv Conservatory / Wikimedia Ukraine collaboration. Yuriy
Bulka made the recordings. They are not CC0/CC BY and must not be relabelled to
pass the current admission compiler. Share-alike audiovisual adaptation terms
need a separate delivery decision. No media has been downloaded or auditioned.

| Recording                                                                                                                                                                               | Pianist               | Published duration |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------ |
| [Couranta, Ukrainian Suite](https://commons.wikimedia.org/wiki/File:Lysenko-Suite-02-Couranta.ogg)                                                                                      | Lesia Lemekh          | 3:34               |
| [Valse of Farewell](https://commons.wikimedia.org/wiki/File:Lysenko-Valse_of_farewell.ogg)                                                                                              | Zenovija-Anna Danchak | 3:55               |
| [Barcarole](https://commons.wikimedia.org/wiki/File:Lysenko-Barcarole.ogg)                                                                                                              | Olha Bilas            | 3:09               |
| [Dream, op. 12](https://commons.wikimedia.org/wiki/File:Lysenko-Dream_op._12.ogg)                                                                                                       | Iryna Posviatovs'ka   | 4:22               |
| [Song of Love](https://commons.wikimedia.org/wiki/File:Lysenko-Song_of_love.ogg)                                                                                                        | Olena Havjuk-Sheremet | 3:12               |
| [By a Cradle](<https://commons.wikimedia.org/wiki/File:Lysenko-Lullaby_(%C2%AB%D0%9F%D1%96%D1%81%D0%BD%D1%8F_%D0%BF%D1%80%D0%B8_%D0%BA%D0%BE%D0%BB%D0%B8%D1%81%D1%86%D1%96%C2%BB).ogg>) | Zenovija-Anna Danchak | 5:01               |

Dream's source identifies its folk-song basis, «На солодкім меду». The collection
is documented Ukrainian classical piano music, not an energetic folk-electronic
album. Its composition/edition clearance and gameplay context remain separate
from recording permission.

## Qualification evidence and current blockers

Archive PR #2 retains failed intake runs 35943657893, 35943774127 and 35943850666 (three source filenames did not match creator download links). Run 35944115394 then passed 13 recordings and rejected Angry Bullfrogs Riding Motorbikes because it is shorter than the 60-second intake floor. The candidate was excluded; the duration gate was not waived. Run 35944483804 subsequently hit HTTP 502 on one source. Fresh run 35944843598 at archive source `4e9e572848848a314cd48f31a290b83850ee6b65` passed all 13. Artifact 10786113658 has ZIP SHA-256 `0b95238aa7bb27a89b12864f35ac1df850e7a69dae5b7fea3257a764ebf58f5c`.

Full game qualification run 35944418013 at `913306a736443959b4b8ff913c0976093a2b06bb` failed before source validation: two inherited release-utility diagnostics fixtures exhaust mocked Git responses in `publishing/utility/test_upload_diagnostics.py`. The separately reviewed fixture-only repair, PR #322, is accepted at `d0c73b4723798f6490f2680a59fd8d8a59983ac1`. Soundtrack work has been rebased onto that accepted fix; full qualification of the refreshed exact head remains required. Later gates were skipped, not passed. The four local archive-builder tests could not pass the existing 1 GiB free-disk guard; hosted qualification must cover them.

## Candidate files now on GitHub

Archive PR #2 commits all 13 MP3 derivatives (57,494,195 bytes), their exact native downloads and licence snapshots at `9e386c9c489bd193c830cd60ac6f26e7553dc335`. Hosted Pages verification 35945506601 checked all 83 archive recordings and 412,480,317 audio bytes. The original 70-recording inventory and static pins remain unchanged. New files live under `batches/core-20260924/`; source evidence is retained under `intake/archive/core-20260924/`. The browser preview's metal filter and combined retro/search controls were checked locally. Public deployment/playback and musical acceptance are still separate gates.

Ukrainian archive PR #3 prepares one distinct composition: Alexander Nakarada's **Carol of the Bells (Metal Version)**, accurately described as a Ukrainian-melody metal adaptation of Shchedryk. Hosted run 35945483057 passed complete decoding, game inspection and encoded measurements: 270.028 seconds, −15.99 LUFS, −4.56 dBTP. Exact creator licence, Content ID and FAQ snapshots are retained. Content ID is **true**, so recording mode excludes it. Full listening, instrumental-content and Ukrainian cultural review are still pending; this one adaptation does not complete the 4–6-recording target.

## Remaining release gates

1. Complete technical preparation and independently check exact source/derivative evidence.
2. Listen to every complete candidate, including repeated playback, transitions,
   warnings, mono and small-speaker use. Obtain cultural review for Ukrainian
   entries. Do not fabricate reviewer names or approval timestamps.
3. Commit permitted MP3s and archive source masters with verified hashes. Publish
   each approved batch under a new immutable archive base path; preserve the old
   70-track inventory and objects.
4. Admit only the reviewed batch through the game compiler; retain source,
   licence, exact recording identity, scene/energy metadata and Content ID status.
5. Verify online playback, mixed queues, installation/removal and cold offline
   playback. Qualify the actual integrated release source through the established
   six gates, hosted build and independent artifact checks.
6. Coordinate the next version with the Releases task, then release through a
   game PR and separate Pages selector PR. Verify the public version and playback.

Existing-collection curation and broader storage/device improvements follow
these batches. Metadata changes to existing catalogue IDs need the approved
trusted ID/hash curation overlay rather than replacement of saved pins.

## Effort estimates

Retro and metal preparation: 1–2 working days per 6–10-track accepted batch.
Ukrainian research/preparation: 1–2 days; permission and reviewer availability
prevent a reliable publication date. CI queues and listening review are outside
these engineering estimates. New music remains unapproved until all relevant
gates above are actually complete.
