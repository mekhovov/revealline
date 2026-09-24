# Core soundtrack expansion — updated 24 September 2026

## Priority and accounting

Complete stronger retro and heavier metal first, while progressing a varied Ukrainian collection with documented musical roots. Deliver small reviewed batches through separate PRs
and verify each public release. Do not pad the collection with alternate versions
of one composition or loosely labelled generic folk music.

| Category                                        | Actual completed state                                                      | Still pending                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Existing game catalogue                         | 70 hosted recordings in 15 albums; identities and inventory preserved       | Full musical listening acceptance and later curation                           |
| New retro/metal preview                         | 13 recordings publicly available: 7 retro, 6 metal                          | Musical acceptance and admission into the game                                 |
| New Ukrainian preview                           | 1 Shchedryk/metal recording publicly available through merged archive PR #3 | Full listening, instrumental and cultural review, game admission               |
| New standard game recordings from these batches | **0 approved/admitted**                                                     | Admit only after the recording-specific review gates pass                      |
| UA-FPV                                          | Existing private upload packs preserve 80 filenames / 77 unique recordings  | Recording-specific public redistribution permission                            |
| GPT originals                                   | **0/36 approved; production paused**                                        | Reconsider production method only after the licensed core styles are delivered |

Archive previews and technically qualified candidates are not additional game
built-ins. The existing baseline includes simplified music controls, a fresh-profile synth
default, shuffle-all, uploads, custom playlists and offline albums. This plan
extends that catalogue; it does not claim new verification of every baseline
feature in this delivery.

## Completed

### Core archive delivery

- Archive PR #2 merged at `7a334fdf`; Pages run **35945896276** succeeded.
- The [core listening preview](https://mekhovov.github.io/revealline-soundtracks-01/batches/core-20260924/)
  publicly serves all 13 permitted MP3 derivatives, totalling **57,494,195 bytes**.
- Direct public checks verified the exact bytes and hashes of all 13 MP3s and
  five checked static files. Limited browser playback/filter checks establish
  technical operation only, not complete-track listening approval.
- Exact native sources, creator-page licence snapshots and technical receipts
  are retained under `intake/archive/core-20260924/`. New public files use the
  immutable `batches/core-20260924/` base; the original 70-recording inventory,
  objects and static pins remain unchanged.
- All 13 passed full decoding, native game MP3 inspection and encoded loudness /
  peak checks. The six metal candidates are four Vitalezzz recordings, Bogart
  VGM's _German Industrial Metal_ and MintoDog's _Heavy Boss Battle 1_. The seven
  retro candidates are distinct Ragnar Random compositions; several are short
  arcade cues and must be judged as such.

### Framework and Ukrainian preparation

- Game PR #321 implements additive, exact-hash reviewed-batch admission and
  narrowly allowed immutable archive batch URLs. Pending entries cannot grant
  themselves rights or listening approval; the current 70 identities remain
  unchanged. Focused tests passed **77/77**, with an independent **39-test** rerun.
- At game head **`539418e`**, preflight and production qualification gates have
  passed. **Four explicit test shards are still running; the source is unfrozen.**
  Regular PR build **35945949208** passed; its policy-skipped test and release
  gate are not passes. This is not a released framework update. Evidence added
  after `539418e` is documentation only; do not attribute that earlier run to a
  later commit.
- Archive PR #3 at **`f7a2fcf`** passed independent review and all three exact-head
  archive checks, then merged at **`9dd04b6`**. Pages run **35946536633** succeeded.
  The [Shchedryk listening preview](https://mekhovov.github.io/revealline-soundtracks-01/batches/ukrainian-shchedryk-20260924/)
  serves one Alexander Nakarada recording, _Carol of the Bells (Metal Version)_.
  Technical qualification measured:
  **270.028 seconds, −15.99 LUFS, −4.56 dBTP**. All three creator track/licensing/FAQ
  snapshots and exact source/delivery identities are preserved. Public verification
  checked its 8,641,768-byte MP3 and eight metadata/static files against the
  committed hashes. Browser playback advanced to 14 seconds with no media error;
  Pause worked. These are technical checks, not musical approval.
- The Ukrainian candidate is a **Ukrainian-melody metal adaptation of Shchedryk**,
  with cultural and instrumental review pending. **Content ID is registered**;
  Recording mode must exclude it. One adaptation does not complete the intended
  4–6 distinct Ukrainian recordings. Full listening review of the existing 70 is
  not a prerequisite for releasing a separately accepted new batch.

## Remaining phases, release order and effort

These are approximate hands-on engineering efforts, not delivery dates. Listening,
rights decisions, reviewer availability and hosted CI queues can extend elapsed time.

| Priority      | Next deliverable                               | Remaining work and acceptance                                                                                                                                                                                                                                                                                                                                                                  | Engineering effort                                                                                                                                       |
| ------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1             | Finish the started technical changes           | Complete PR #321's four explicitly enabled shards and publisher coordination. Independent source review, the regular PR build and both archive deployments are complete. The current game PR update only adds evidence/documentation after checked source `539418e`; a future admitted release needs fresh qualification of its actual source. Retain every failed or partial run.             | 0.5–1 day, plus CI/publisher queue                                                                                                                       |
| 1A — parallel | First reviewed retro/metal game batch          | Review all 13 full tracks and reject weak fits. Confirm retro instrumentation/energy and heavier metal articulation; check repeated sessions, transitions, warning audibility, mono and small speakers. Record genuine reviewer evidence. Admit only accepted recordings with exact rights/hash pins and scene/energy metadata.                                                                | 0.5–1 day after listening decisions; allow a separate 2–4-hour listening session, with repetition/device checks additional                               |
| 1B — parallel | First accurate Ukrainian game admission        | Complete full-track, instrumental and Ukrainian cultural review of the Nakarada candidate. Admit it only if accepted, retaining its adaptation label and Content ID exclusion. Seek additional distinct compositions with recording-specific rights and authorized downloads; publish accepted pieces incrementally.                                                                           | 0.5–1 day for the prepared candidate after review; 1–2 days of bounded research/preparation for further candidates, with no reliable rights/reviewer ETA |
| 3             | Qualify and publish the resulting game release | Test current/next transport, mixed queues, menu/game continuity, installs/removal, backup restoration and cold offline restart. Qualify the actual integrated source, freeze and independently inspect the hosted artifact, allocate the version through the release owner, publish through the game PR plus separate Pages selector PR, and directly prove public playback/version/downloads. | 0.5–1 day, plus CI/release queue                                                                                                                         |
| 5             | Curate the existing collection                 | Review weak or short fits in the existing 70, refine style/scene/energy matching through the trusted ID/hash curation overlay, and retain saved identities. Broader genres follow core-style acceptance.                                                                                                                                                                                       | 1–2 days per selected curation batch, plus listening                                                                                                     |
| Deferred      | Original production and blocked recordings     | Keep AI production paused after the rejected pilots. Preserve scores/evidence for a later quality-method decision. UA-FPV public hosting and restricted-license sources remain on hold; existing private upload packs remain available.                                                                                                                                                        | No responsible completion date until the relevant quality/rights dependencies are resolved                                                               |

Priorities 1A and 1B run in parallel. Either accepted family can ship first;
Ukrainian sourcing does not hold a completed retro/metal batch.

The Releases task controls version allocation and sequencing. Its current
queue is PR #314 / v0.97 followed by PR #320 / provisional v0.98; authoritative
owner confirmation is required before allocating a soundtrack version. No new
version is allocated by this plan. Keep unrelated queued changes isolated; refresh
against accepted main before freezing and requalify any resulting source changes.
Archive-only publication does not bump the game's version or demonstrate game
admission. Once a game item is ready, ship it independently rather than waiting for
every musical family or the paused 36-original milestone.

## Rights and musical holds preserved

- **Oleg Mazur — [Ой у лузі червона калина](https://soundcloud.com/fm_freemusic/oy-u-luz-chervona-kalina-the-red-viburnum-in-the-meadow-ukrainian-patriotic-march-by-oleg-mazur)
  and [Prayer for Ukraine](https://soundcloud.com/fm_freemusic/bozhe-velikiy-diniy-prayer-for-ukraine-spiritual-anthem-of-ukraine-by-oleg-mazur):**
  creator CC-BY leads remain held for an exact authorized original and licence
  version. Hypeddit currently asks for SoundCloud connection, comment, like,
  repost and follow; none are authorized or performed. Prayer is a solemn/menu
  possibility, not presumed action music.
- **[Mark Wilson X — Carol of the Bells](https://freemusicarchive.org/music/mark-wilson-x/single/carol-of-the-bells/):**
  [creator CC BY 4.0 statement](https://soundcloud.com/mark-wilson-x/carol-of-the-bells-royalty-free-cc-by) and approximately 1:21 instrumental metadata remain leads;
  exact acquisition/arrangement review is unresolved after the research reader's
  HTTP 403. Another Shchedryk arrangement does not add a distinct composition.
- **Pixabay [Hutsul Havoc](https://pixabay.com/music/main-title-hutsul-havoc-ethno-action-ukrainian-soundtrack-192015/), [Hutsul Fantasy](https://pixabay.com/music/folk-hutsul-fantasy-132797/) and bandura recordings:** standalone MP3 redistribution is not
  cleared. Hutsul Fantasy is credited to `_Music_for_Creators_`, not Rockot.
  Keep these outside the public archive unless recording-specific permission
  resolves delivery. Do not substitute preview hotlinks for permission.
- **Six Lysenko piano performances:** Couranta, Valse of Farewell, Barcarole,
  Dream op. 12, Song of Love and By a Cradle retain their documented Lviv
  Conservatory / Wikimedia Ukraine recording provenance and **CC BY-SA 3.0**
  status. They are held for a separate share-alike audiovisual delivery decision;
  do not relabel them as CC BY to pass the compiler. The exact file, pianist and duration table remains below. Their composition /
  edition clearance and classical context remain separate from recording rights.
- **UA-FPV:** possession and YouTube availability do not establish public MP3
  redistribution rights. Keep the existing private packs and upload guide; no
  outreach or new public admission is implied.
- **Generic geographic titles:** Holizna's _Ukraine_ and similar labels alone do
  not establish Ukrainian musical motifs. Do not use them to fill a numeric quota.

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

### New optional ceremonial lead — not an admission

[Luke Minovych Horenko — Ще не вмерла Україна](https://commons.wikimedia.org/wiki/File:%D0%9B._%D0%93%D0%BE%D1%80%D0%B5%D0%BD%D0%BA%D0%BE_-_%D0%A9%D0%B5_%D0%BD%D0%B5_%D0%B2%D0%BC%D0%B5%D1%80%D0%BB%D0%B0_%D0%A3%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D0%B0.ogg)
is a creator-published synthesized instrumental recording under **CC0**, dated
27 March 2020, with a directly linked authorized original. Source metadata gives
93.214 seconds and 4,233,544 bytes; these have not been verified against acquired
audio. [Ukrainian government composition history](https://www.kmu.gov.ua/news/247989866)
identifies Verbytsky's music and Chubynsky's text.

Hold it for sound quality, composition/arrangement and cultural-context review.
It is an optional ceremonial/menu possibility, not a substitute for the requested
energetic Ukrainian repertoire. The US Navy rendition is the same composition and
must not be counted again. No audio was downloaded or auditioned during this lead's
research.

## Public verification records

Committed reports under `docs/verification/core-soundtracks-2026-09-24/` record
exact public bytes/hashes, deployed commit/run identities and limited desktop
browser observations. The first Ukrainian HTTP probe incorrectly required the
hidden `.nojekyll` Pages control marker to be publicly served and got HTTP 404.
That failed attempt is retained. The corrected probe excludes only that marker
and requires every runtime asset, MP3 and public metadata file to match. It does
not count the control marker as an HTTP pass.

## Historical qualification evidence — retain

- Archive failed intake runs **35943657893**, **35943774127** and **35943850666**:
  three source filenames differed from creator download links.
- Run **35944115394** passed 13 recordings and rejected _Angry Bullfrogs Riding
  Motorbikes_ below the 60-second floor. It was excluded; the gate was not waived.
- Run **35944483804** encountered source HTTP 502. Fresh run **35944843598** at
  `4e9e572848848a314cd48f31a290b83850ee6b65` passed all 13. Artifact **10786113658**
  has ZIP SHA-256
  `0b95238aa7bb27a89b12864f35ac1df850e7a69dae5b7fea3257a764ebf58f5c`.
- Source/derivative archival commit **`9e386c9c489bd193c830cd60ac6f26e7553dc335`**
  preserved all 13 MP3s, native originals and snapshots. Hosted verification
  **35945506601** checked the archive's then-total **83 recordings / 412,480,317
  audio bytes**. This is an archive count, not the game's built-in count.
- Game qualification **35944418013** at
  `913306a736443959b4b8ff913c0976093a2b06bb` failed before source validation because
  two inherited diagnostics fixtures exhausted mocked Git responses in
  `publishing/utility/test_upload_diagnostics.py`. Later gates were skipped, not
  passed. The independently reviewed fixture-only PR #322 was accepted at
  `d0c73b4723798f6490f2680a59fd8d8a59983ac1`; the soundtrack branch was refreshed
  onto that fix. Current exact-head progress is reported above.
- Four local archive-builder tests were blocked by the existing **1 GiB free-disk
  guard**. Do not bypass it or count blocked checks as passes. Use hosted audio
  acquisition, builds and actual-byte verification while local reserve is low.
- Ukrainian technical run **35945483057** passed the prepared Nakarada recording.
  It provides no full listening, instrumental-content or cultural approval.

Physical iPhone/desktop listening and cold offline checks remain distinct from
automated or simulated checks. No reviewer names, approval timestamps or musical
acceptance may be inferred from technical success.
