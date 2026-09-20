# Soundtrack expansion: implementation and production status

The target is 36 distinct original compositions: twelve each for 90s Synth, Metal and Ukrainian music, with two menu pieces, eight gameplay pieces and two finales per family. Six pieces combine two families. Alternate mixes and file formats are not additional compositions.

## Available source implementation

The Music Studio offers Automatic, 90s Synth, Metal, Ukrainian, Fusion and My Mix, including family checkboxes and Installed only. Explicit playlists override automatic matching. Uploaded tracks can carry genre/fusion, scene, energy and world tags, including scene and world tags without a genre classification. Automatic first selects tracks eligible for the current scene, then prefers matching world tags. Energy is retained for production curation; the game does not yet supply a level mood or energy target. Untagged uploads remain usable in ordinary playlists. A requested Ukrainian or fusion selection with no available recordings stays silent and reports the missing selection.

The persistent player uses at most two media decks, preloading only the next recording and crossfading over 1.5 seconds (bounded for short clips). Synth or unavailable overlap uses a sequential transition. Menu selection changes on entering title/campaign browsing; ordinary Settings, Pause, results and retries retain the current scene. A remembered sound-on preference starts at an eligible trusted menu gesture, while music-only Pause remains intentional.

Version-local catalogue MP3 downloads validate exact size, hash and MPEG frame facts. Imported descriptor paths never authorize network requests. Available original recordings can be installed in volumes of up to six; removing an offline copy retains its playlist references. Complete backups fetch missing trusted originals explicitly or fail visibly. No background album installation or automatic deletion occurs.

The 24 retained community compositions are separate optional albums. They contain Holizna, 3xBlast, Emma_MA, HydroGene and Vitalezzz recordings with source credits and exact-byte provenance. Their four binary albums total approximately 139 MiB. **Remove offline download** keeps track identities, credits, edits and playlist references; **Download again** retrieves the exact shipped album. Save confirms either change, and Undo restores the saved library. Bytes also required by a separate personal upload or another installed recording stay protected. Offloaded bonus tracks are skipped without an implicit album download. Complete backups and shares require their missing recordings to be downloaded again first. These are not RevealLine original compositions and do not establish the quality of the planned Ukrainian album. See the [source register](../authoring/library/licensed-audio/README.md).

## Compatibility and creator albums

Current solo, practice, Couch installed-content and standalone still-media hosts explicitly open shared IndexedDB version 5. The database name and existing blob stores are unchanged. Reading legacy soundtrack v1 data does not rewrite its metadata or originals. The first successful v2 Save remains atomic and generation-checked. Older readers fail with a recovery message rather than interpreting unsupported catalogue references.

Soundtrack-library v2 adds catalogue pins, installed catalogue IDs, custom track tags, listening preferences and optional bonus-album ownership. Bonus ownership carries no network paths or permission to fetch; only the shipped album catalogue authorizes explicit download. It retains all historical built-in identities and independent capacity for 123 uploads and 26 custom playlists. Soundtrack-bundle v2 includes exact originals; v1 imports remain supported. The existing shared 256 MiB committed/staging budget and 64 MiB optional album target remain in force.

Creator shares use a selected custom playlist and all its referenced originals. Personal uploads require a publication-rights declaration before sharing. **Add album file to draft** merges identities and bytes without replacing the current selection or assignments; collisions are rejected. **Review backup as replacement draft** retains its existing replacement semantics. Preparation and the explicit download action remain separate; neither a prepared Blob nor an accepted download request proves a disk write.

## Original production remains pending

The [36 production briefs](../authoring/library/revealline-original-soundtrack/BRIEFS.md) contain independent motifs, instrumentation, forms, regional research and hosted-generation prompts. Four pilots precede full production. The runtime original catalogue is intentionally empty until actual recordings pass review; it contains no invented asset hashes or silent stand-ins.

The agreed production route is the official hosted ACE-Step demo followed by browser-based finishing. The company's network returned **Unapproved AI Resource / Block - Unapproved Generative AI** for the hosted inference endpoint during planning. Approved access is a prerequisite. No local generation model, paid subscription or network-policy workaround is part of this implementation.

Publication requires native-resolution lossless masters, MP3 derivatives, exact source hashes, production/session/rights evidence, full-file decoding, a game-mix target of −16 LUFS ±1 LU and encoded true peak at or below −1 dBTP, complete listening, in-game mix/transition review and Ukrainian cultural review where applicable. The compiler checks the pinned receipts; it does not itself listen to music or confer cultural approval.

Automated model, storage, transport and browser checks are separate from musical listening, physical-device qualification and public release. No claim of 36 finished recordings is made.
