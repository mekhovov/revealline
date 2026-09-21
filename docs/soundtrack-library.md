# Soundtrack library and staged music production

The current source includes 70 licensed creator recordings in 15 built-in albums, served by one admitted, separately published soundtrack archive. See [hosted music and player controls](hosted-soundtracks.md) for online playback, optional offline installation and the repository connection. Rights and exact-byte delivery evidence support this admission; musical suitability and full listening review remain pending. Source integration is not a claim that this game release has completed qualification or public deployment.

AI original production is paused, with **0 of 36 reviewed originals** delivered. The retained production history contains seven distinct composition candidates with complete local renders: both attempted versions of Idle Frequency were rejected, and six other complete candidates remain unreviewed. The two short alternative retro sketches were also rejected; they are direction tests, not additional compositions. Existing procedural music and player MP3 imports remain available. The runtime never counts briefs, alternate renders or technical checks as finished songs.

## Player and creator controls

Music Studio supports Automatic, nine music styles including 90s Synth, Metal and Ukrainian, Fusion and My Mix, genre checkboxes, built-in albums, custom ordered/shuffled playlists, repeat-all and repeat-one. Explicit playlists win over scene matching. Automatic selects among eligible menu/gameplay roles, world tags and an optional authored energy target. Selecting music never changes the world or earned artwork.

Title and campaign browsing use the menu context. Settings, pause, results and retries preserve the current gameplay song. The transport retains at most two decks, prepares current and next only, and uses a 1.5-second crossfade where supported. Sequential playback remains available when gain routing is unavailable. Master mute, music-only Pause, browser unlock failure, interruption recovery and practice ownership remain separate controls.

The title/game and Studio show the audible MP3 title and artist. Studio details retain the uploaded filename and source link. A source website is opened only through a normal HTTP(S) link without embedded credentials. Known Content ID recordings and recordings without verified gameplay-video permission are excluded by Recording mode. This filter cannot promise that automated claims will never occur.

Uploads preserve exact original bytes. Creators can edit tags, menu/gameplay/finale role, energy and theme matches, build playlists, audition tracks, prepare a playlist as an additive album file, and import an album into the current draft. Download/export preparation is separate from requesting the file. Save publishes a checked draft transactionally; a post-save host-adoption failure does not start playback against stale media.

Catalogue recordings can play online without manual import; the player verifies the complete current MP3 and prepares at most the next recording, not the whole album. Offline album downloads are optional and outside automatic core precaching. Downloads are saved explicitly; removing downloaded catalogue audio retains its recording metadata and playlist references. Shared installed audio, pictures and stories remain subject to the existing 256 MiB media budget. The 338.5 MiB hosted collection cannot all be installed at once. Built-in recordings and albums do not consume custom upload or playlist slots.

## Trusted permissions and recovery

Catalogue v2 records bind web playback, offline caching, redistribution, modification and gameplay-video permissions to exact recording IDs and SHA-256 hashes. Imported credits, policy fields and renamed aliases cannot grant authority. A restriction attached to a known hash also applies to another name for the same bytes.

Library/bundle v3 imports existing v1/v2 libraries. It retains the previous 123 uploaded-track and 26 custom-playlist capacities, with a separate 256-recording catalogue and 512-asset envelope. Shared IndexedDB version 5 retains existing metadata and blobs during upgrade; conversion is published only by a successful atomic save. Frozen older readers receive a compatibility failure instead of overwriting newer data.

A v3 recovery file includes every permitted personal, installed or explicitly referenced original with its exact bytes. Unused, uninstalled trusted catalogue entries are omitted and rediscovered in an edition that includes them; backup preparation does not download them all. Restricted recordings are listed explicitly as references without audio, with the notice **Requires online restoration for listed music** before export and after import. It is not described as a complete offline backup. Missing permitted originals cause export/import refusal, not silent conversion to URL-only records. Reference-only aliases without the trusted catalogue remain conservative references; a trusted hash match is required for online restoration.

The complete game backup and standalone `.rlsound` checker follow the same coverage contract. Additive sharing retains restricted references and does not let an imported policy authorize network requests or exports.

## Publication inputs

- [Original production](../authoring/library/revealline-original-soundtrack/README.md): reproducible scores, small procedural instrument definitions, seeds, source receipts, FLAC masters and 256 kb/s MP3 candidates. The native render receipts distinguish measured loudness/estimated peaks, full decode, exact lossless round trip and uncompleted listening review.
- [Hosted creator recordings](../authoring/library/licensed-audio/hosted-README.md): 70 CC0/CC BY recordings in 15 albums, backed by [license revalidation](../authoring/library/licensed-audio/provenance/license-revalidation.json) and [pinned hosted delivery evidence](../authoring/library/licensed-audio/hosted-evidence.json). Listening approval remains pending. The earlier [30-candidate research](research/music-licensing/README.md) remains historical evidence, not the current catalogue count.
- [UA-FPV](../authoring/library/ua-fpv/README.md): 80 supplied filenames representing 77 unique recordings. All filenames and duplicate aliases are preserved in four local upload packs; see the [upload guide](ua-fpv-upload-guide.md). Public admission still requires separate recording, artwork, source and listening evidence. The approval register is empty; these songs remain local-only and are not in the hosted game catalogue.
- [Published soundtrack archive](https://mekhovov.github.io/revealline-soundtracks-01/): 70 exact MP3 objects with artist/source/license credits and an immutable inventory. The [archive staging notes](research/music-licensing/archive-staging.md) describe the earlier reviewed-source pipeline; current hosted admission is documented separately below.

`scripts/soundtrack-distribution.mjs` combines two distinct publication paths. Originals and the older licensed pipeline retain their existing review gates. The hosted path, `scripts/hosted-soundtrack-publication.mjs`, validates the separate code-owned `hosted-publication.json` authorization against pinned source, license, inventory and prior delivery evidence. It admits these 70 recordings without inventing listening approval or requiring local MP3 copies. Historical preview-only authorizations and review records remain unchanged.

`writePublishedSoundtrackMetadata(root)` updates the shipped catalogue JSON and static catalogue/archive/collection module together; the build rejects stale metadata. Hosted MP3s remain outside the game payload. Technical producer tests use reproducible small fixtures, including distinct source/MP3 derivative provenance, without private audio or conditional skips. Retained scores, candidates and review receipts remain separate from catalogue admission.

The older archive path uses `soundtrack-archive-admissions.json` and approved source bytes through `delivery: 'source'`. The hosted path carries its independently verified archive admission in the pinned hosted publication input. Both reject conflicting inventories and restrictive hash aliases; staged candidates and imported URLs are not runtime authority. The admitted inventory and object URLs must remain unchanged for this edition; future additions require a new versioned admission as described in [hosted music](hosted-soundtracks.md).

## Remaining music acceptance

The original production target remains 36 reviewed compositions: twelve per family, including six fusions; work is paused at the user's request. Complete listening, repeated-session listening, gameplay warning audibility, transitions, mono/small-speaker checks and Ukrainian musical review remain required before original acceptance. The admitted creator recordings also retain their pending musical review status. Technical pass results do not satisfy those reviews. Rejected renders, sketches and feedback are preserved.

GameDev Market and Pixabay candidates remain held until their exact licenses cover the actual game presentation and web/offline delivery. Mixkit music is excluded because its music license prohibits games. Removing a download button, hiding a filename or hotlinking a preview does not establish permission.

Physical iPhone, desktop/controller qualification, final frozen-build offline testing and public deployment are separate evidence milestones. Local host tests and source-browser observations must not be presented as those results.
