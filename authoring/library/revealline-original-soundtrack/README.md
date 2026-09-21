# RevealLine original soundtrack production

This contains **36 composition briefs, seven distinct complete candidate compositions, eight full recording attempts and two short direction sketches, with zero review-complete or approved originals**. [Local production and audition](local-production/README.md) retains six balanced pilots plus Steel Kolomyika, their inspectable scores, 24-bit FLAC masters, 256 kbps MP3s and measurement receipts. The two full Idle Frequency versions were rejected in user style review; both are retained with feedback. The two subsequent short sketches await direction review and do not count as complete compositions. These originals are separate from third-party recordings in `../licensed-audio/`. The game’s ready first-party catalogue remains empty until actual audio and all review evidence pass the compiler. Briefs and test silence are never counted as finished songs; technical measurements do not complete listening, mix, cultural or publication review.

- [Complete briefs and effective prompts](BRIEFS.md): 12 compositions per family; exactly two menu, eight gameplay and two finale pieces each. Six pieces are fusions, two per primary family. Their genre tags make them available in either family without duplicating recordings.
- [Machine-readable production catalogue](production.json): original motifs, tempo, meter, instrumentation, form, visual fit, references and shared delivery requirements.
- [Source research](RESEARCH.md) and [reference register](references.json): observed source facts are separated from our proposed musical direction.
- [Production workflow](PRODUCTION.md): the local-first six-pilot slate, Steel Kolomyika fusion check, source receipts and review. Hosted generation, model downloads and additional sample libraries are later options, not the current production route.
- [Review ledger](review-ledger.json): retained initial approval checklist; every gate is pending. Actual local render attempts and measurements are in [the candidate register](local-production/candidates.json) and its per-recording receipts. [Ready register](ready.json): no tracks.

Validate and compile the current approved state with:

```sh
mkdir -p .cache
node authoring/library/revealline-original-soundtrack/build.mjs --output .cache/original-soundtrack-check
```

The destination must be new. Today this writes an empty `soundtrack-catalogue.json` and reports zero ready recordings. The compiler performs no network access, AI generation, transcoding, model installation or storage mutation. `buildOriginalSoundtrackCatalogue()` returns `{ catalogue, files, receipts }`; every `files` item is `{ name, bytes }` and its name exactly matches a trusted catalogue track path. Release integration compares the generated catalogue with `game/content/soundtrack-catalogue.json` and places approved MP3s outside the automatic precache.

For promotion, a ready entry references one planned composition and supplies actual `master`, `mp3` and `review` pins (`{path, bytes, sha256}`), an `artist`, explicit `rights: {kind:'original', credit, license, source}`, and an exact track/hash-bound `policy`. The source is an HTTPS provenance page; the local review retains the detailed evidence. The compiler accepts native-resolution stereo WAV (44.1/48 kHz; PCM16/24/32 or float32) or FLAC (PCM16/24/32), inspected MP3 frames, matching durations, and a pinned approval record. FLAC metadata inspection is distinct from full decoding and lossless round-trip verification, which the local render receipts record. See the approval shape in PRODUCTION.md and the compiler tests. A passing compiler verifies the declared files and completed review assertions; it does not listen or make the reviewer’s musical judgment.

Approved originals become catalogue-v2 `builtin.catalog.original.<slug>` entries with edition, exact path/hash/byte pins, original filename, provenance website, explicit permission policy and genre/role/energy/theme tags. Their runtime role is `intense` for the authoring role `finale`. The production catalogue remains a record of the original brief; actual production state is carried by the candidate receipts, approval ledger and ready register. Updating the ledger alone cannot publish audio.

Plan two six-track offline groups per genre to stay below the 64 MiB optional-album target. Full-length 256 kb/s music for all 36 tracks can exceed the 256 MiB store shared with other media. Install selectively; never delete user media or silently lower source quality to force the full set into a profile. Store and share the exact retained bytes.
