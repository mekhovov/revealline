# Soundtrack library and staged music production

This implementation adds the soundtrack framework. It does **not** deliver 36 reviewed recordings. As of 21 September 2026, seven distinct composition candidates have complete local renders; the two attempted versions of Idle Frequency were rejected by the user. Six other complete candidates await listening and musical review. Two short alternative retro sketches are direction tests, not additional compositions. No new original or creator recording has been admitted to the public catalogue.

The current public catalogue and archive admissions are deliberately empty. Existing procedural music remains available alongside player MP3 imports. The runtime never counts composition briefs, alternate renders, technical checks or unavailable catalogue placeholders as finished songs.

## Player and creator controls

Music Studio supports Automatic, 90s Synth, Metal, Ukrainian, Fusion and My Mix, genre checkboxes, custom ordered/shuffled playlists, repeat-all and repeat-one. Explicit playlists win over scene matching. Automatic selects among eligible menu/gameplay roles, world tags and an optional authored energy target. Selecting music never changes the world or earned artwork.

Title and campaign browsing use the menu context. Settings, pause, results and retries preserve the current gameplay song. The transport retains at most two decks, prepares current and next only, and uses a 1.5-second crossfade where supported. Sequential playback remains available when gain routing is unavailable. Master mute, music-only Pause, browser unlock failure, interruption recovery and practice ownership remain separate controls.

The title/game and Studio show the audible MP3 title and artist. Studio details retain the uploaded filename and source link. A source website is opened only through a normal HTTP(S) link without embedded credentials. Known Content ID recordings and recordings without verified gameplay-video permission are excluded by Recording mode. This filter cannot promise that automated claims will never occur.

Uploads preserve exact original bytes. Creators can edit tags, menu/gameplay/finale role, energy and theme matches, build playlists, audition tracks, prepare a playlist as an additive album file, and import an album into the current draft. Download/export preparation is separate from requesting the file. Save publishes a checked draft transactionally; a post-save host-adoption failure does not start playback against stale media.

Reviewed catalogue volumes are optional downloads outside automatic core precaching. Downloads are saved explicitly; removing downloaded catalogue audio retains its recording metadata and playlist references. Shared installed audio, pictures and stories remain subject to the existing 256 MiB media budget. A catalogue's availability does not mean every album fits at once.

## Trusted permissions and recovery

Catalogue v2 records bind web playback, offline caching, redistribution, modification and gameplay-video permissions to exact recording IDs and SHA-256 hashes. Imported credits, policy fields and renamed aliases cannot grant authority. A restriction attached to a known hash also applies to another name for the same bytes.

Library/bundle v3 imports existing v1/v2 libraries. It retains the previous 123 uploaded-track and 26 custom-playlist capacities, with a separate 256-recording catalogue and 512-asset envelope. Shared IndexedDB version 5 retains existing metadata and blobs during upgrade; conversion is published only by a successful atomic save. Frozen older readers receive a compatibility failure instead of overwriting newer data.

A v3 recovery file includes every permitted referenced original with its exact bytes. Restricted recordings are listed explicitly as references without audio, with the notice **Requires online restoration for listed music** before export and after import. It is not described as a complete offline backup. Missing permitted originals cause export/import refusal, not silent conversion to URL-only records. Reference-only aliases without the trusted catalogue remain conservative references; a trusted hash match is required for online restoration.

The complete game backup and standalone `.rlsound` checker follow the same coverage contract. Additive sharing retains restricted references and does not let an imported policy authorize network requests or exports.

## Publication inputs

- [Original production](../authoring/library/revealline-original-soundtrack/README.md): reproducible scores, small procedural instrument definitions, seeds, source receipts, FLAC masters and 256 kb/s MP3 candidates. The native render receipts distinguish measured loudness/estimated peaks, full decode, exact lossless round trip and uncompleted listening review.
- [Creator recordings](research/music-licensing/README.md): 30 candidates, including the earlier 24 recordings and six additional FM/tracker/metal candidates. Source licenses and exact files were revalidated. Listening admission remains empty.
- [UA-FPV](../authoring/library/ua-fpv/README.md): 80 supplied filenames representing 77 unique recordings. The compiler preserves duplicate aliases and requires recording, artwork, source and listening evidence. Cleared entries form their own UA-FPV playlist and download volumes, and also participate in Ukrainian/mixed playlists. The current approval register is empty; no supplied song has been copied into the public runtime.
- [Archive staging](research/music-licensing/archive-staging.md): approved redistributable MP3 objects can be staged for a project-owned soundtrack repository, with immutable hash paths, credits and inventory. No soundtrack archive has yet been published.

`scripts/soundtrack-distribution.mjs` compiles only approved recordings. `writePublishedSoundtrackMetadata(root)` updates the shipped JSON and static module together; the build rejects stale metadata. A source checkout contains reproducible scores, receipts and approval ledgers; ignored unreviewed audio remains in local production storage. A missing local creator collection skips only its real-candidate audition-file test. Synthetic transport, permission, publication-refusal and recovery tests still run in a clean checkout.

After a soundtrack archive is deployed and every hosted object verified, commit its exact inventory and verification record under `authoring/library/`, then add its admission to `soundtrack-archive-admissions.json`. The compiler accepts only already reviewed recordings, rejects conflicting host inventories and restrictive hash aliases, and removes admitted remote objects from the game payload. Staging continues to read approved source bytes through `delivery: 'source'`. A staged archive candidate is not runtime authority.

## Remaining music acceptance

The release target is still 36 reviewed originals: twelve per family, including six fusions. Complete listening, repeated-session listening, gameplay warning audibility, transitions, mono/small-speaker checks and Ukrainian musical review remain required. Technical pass results do not satisfy those reviews. The latest retro feedback requires stronger rhythm and a different instrument/melody palette; both rejected renders and their feedback are preserved.

GameDev Market and Pixabay candidates remain held until their exact licenses cover the actual game presentation and web/offline delivery. Mixkit music is excluded because its music license prohibits games. Removing a download button, hiding a filename or hotlinking a preview does not establish permission.

Physical iPhone, desktop/controller qualification, final frozen-build offline testing and public deployment are separate evidence milestones. Local host tests and source-browser observations must not be presented as those results.
