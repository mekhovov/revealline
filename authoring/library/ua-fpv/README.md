# Ukrainian FPV reference inventory

This directory contains **metadata only**. It does not contain or license audio from the locally supplied `docs/research/dah-soundtracks` folder. All 77 distinct recordings have unknown permissions and `publicationAllowed: false`; no audio was copied into authoring or public assets.

[inventory.json](inventory.json) records 80 original filenames, exact SHA-256 values, sizes, directly decoded ID3 title/artist text and CoreAudio packet metadata. Exact duplicates form 77 recording identities. [artist-aliases.json](artist-aliases.json) keeps 41 embedded artist/channel strings and filename-based alias candidates without merging them. An uploader, collaboration title or `- Topic` suffix does not establish composer or recording ownership.

| Measure | Result |
| --- | ---: |
| Files / distinct recordings | 80 / 77 |
| All files | 222,096,227 bytes |
| Distinct recordings | 214,952,083 bytes (204.994 MiB) |
| Largest file | 5,037,982 bytes |
| Distinct packet duration | 13,055.504 seconds, about 3 h 38 min |
| Embedded title / artist | 80 / 80 |
| Embedded source URLs found | 0 |
| Accompanying non-MP3 files | 0 |
| Publication-cleared recordings | 0 |

At least four volumes would be needed under 64 MiB if rights are later established. Distinct MP3s alone leave approximately 51 MiB within the shared 256 MiB budget before manifests, pictures, stories or staging. This collection and the entire open community library cannot all fit simultaneously. These are capacity calculations, not approved album plans.

Three duplicate pairs need identity review:

- A filename beginning `MAGYAR — Єй, Поліна…` duplicates `ДРОНИ БДЖОЛИ…`; embedded tags identify **Хвостаті Ловеласи / ДРОНИ БДЖОЛИ**.
- `Наземний дрон в небі не літає…` duplicates `Мільйон на дрон…`; embedded tags identify **Postmen / Мільйон на дрон**.
- `Y2Mate.is - feat FPV…` duplicates the file named for **НИЦО ПОТВОРНО feat ТЕЛЕБАЧЕННЯ ТОРОНТО**; embedded artist is the **Телебачення Торонто** channel.

The inventory preserves exact filenames; this prose normalizes spelling. Tags are evidence, not confirmed authorship. Official source links, aliases, composition/recording ownership and allowed game/web/offline/export uses remain to be established. No listening, musical quality, cultural accuracy or lyric approval is implied.

To repeat this read-only inspection on macOS, choose a new output path:

```sh
python3 authoring/library/ua-fpv/inventory.py /absolute/local/reference-folder /absolute/new-inventory.json
```

The script uses existing `/usr/bin/afinfo` for packet metadata and standard-library ID3 decoding/SHA-256. Direct ID3 decoding avoids corrupted non-ASCII text emitted by `afinfo -x`. It never modifies input files, installs packages, copies artwork/audio or follows embedded URLs. Duration is metadata, not listening evidence.

## Public admission compiler

[publication.json](publication.json) is intentionally empty. `compileUAFPVSoundtracks({baseDirectory, edition})` from [build.mjs](build.mjs) returns `{tracks: [], files: [], receipts: []}` now. It never reads `inventory.sourceFolder`, copies local reference songs, downloads URLs, changes approvals, or publishes output. A caller can configure the portable authoring directory and final runtime edition; all approved audio/evidence paths inside that directory must be relative and free of symlinks.

A later cleared entry uses `builtin.catalog.ua-fpv.<first 24 SHA-256 characters>` with Ukrainian/gameplay/FPV tags. The prefix identifies the collection without adding a runtime schema field. Exact duplicate files produce one recording; all original filename aliases remain in its review receipt. The displayed `fileName` must be an exact inventoried alias, independent of the portable `approved/` storage path. The compiler preserves approved bytes without retagging, conversion or artwork removal.

An approval requires these fields:

- `sha256`, `file: {path, bytes, sha256}` under `approved/`, `title`, `artist`, `fileName`, and the complete `filenameAliases` from the original inventory.
- `sourceURL`, `credit`, `license`, `licenseURL`, and the existing hash/ID-bound soundtrack `policy`. Public compilation requires `webPlayback` and `redistribute` to be `allowed`; other permissions stay explicit.
- `review: {path, bytes, sha256}` pointing to a structured `revealline-ua-fpv-review.v1` JSON file under `evidence/`. The review names its reviewer/date, binds the audio hash, confirms the same identity/source/filename aliases, and contains recording rights, artwork rights and listening sections.

The review's `recordingRights` names the rights holder and matching licence/attribution/policy, requires game use plus explicit composition, recording, performer, sample, FPV game-context and public-MP3 clearance, and pins the actual permission evidence file. `conditionsMet` must confirm all licence conditions, including attribution. A source website or unverified uploader name is insufficient.

`artworkRights` records `status: "none"` or `"cleared"`, the exact embedded APIC/PIC payload `frames: [{sha256, bytes}]`, public-MP3 permission, completed conditions, retained attribution and a pinned evidence file. Even an absence assertion requires dated review evidence. Embedded art attribution must be included in the public recording credit. The compiler inspects plain ID3v2.2/2.3/2.4 frames, without copying or decoding the pictures; transformed, malformed or unsupported tags refuse admission instead of being treated as artwork-free. Evidence must address every embedded image in the reviewed whole file.

`listening` requires full-track listening, a repeated session, in-game transitions, full technical decode, Ukrainian identity and lyric/context review, plus notes and pinned session evidence. All evidence pins use `{path, bytes, sha256}` below `evidence/`. The compiler checks attestations and exact evidence bytes; it cannot independently establish legal ownership, cultural accuracy, audible quality or the truth of a human review. The synthetic acceptance/refusal examples are in [the compiler tests](../../../scripts/test-ua-fpv-publication.mjs).

The inventory's historical `permissionStatus: "unknown"` is not rewritten by later approvals. A restricted in-game-only clearance remains outside this public compiler. To admit a different delivery file after an authorized metadata/artwork change, first create and review a new exact inventory identity; do not silently substitute bytes under the old approval.
