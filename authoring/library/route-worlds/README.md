# Route Choices in three worlds

| ------------- | ----------------------------------------------------------------------------- | ----------------------- | ----------------- | -------------- |
| Foundry       | Two exits around a warned interceptor; the direct route is a failure control. | Two Lanes, One Forge    | Midnight Workshop | Value Foundry  |
| Depot         | Time the carrier field, or take the longer route without equipment.           | Crosswind Market Depot  | Crosswind Courier | Shared Harbor  |
| Switchback    | Compare signal-resistant travel and cable exposure with the safe rim.         | Carpathian Thread Relay | Signal Thread     | Network Garden |

These are abstract game rules, not representations of battlefield tactics,
historical equipment or financial/product behavior. Their manual ability routes
are Tactical-only. This addition makes no Arcade completion claim and changes no
existing primitive, class roster, difficulty rule, music track or story. The
scenery is independent of collision geometry.

The revised candidate keeps gameplay instructions in player briefings and moves
the foundry study/difficulty qualification to rights metadata and this guide. The
pack description describes the missions; media-production limits remain in rights
metadata and documentation. The published FPV source pack is unchanged. The prior
`fdaf7bd8` candidate, descriptors and proof are retained in Git and review evidence;
these newly derived descriptors require a separate coordinated registry refresh.

## Exact originals and separate payloads

The compiler checks the existing full PNG signature/chunk CRC/decompression/RGB
decoder, exact original SHA-256, byte size and dimensions. It does not crop,
resize, recompress or otherwise transform those files. Each presentation uses
`contain`, `nearest`, revision 1 and `story: null`.

| Edition                | Compact normalized gameplay JSON | Paired `.rlmedia` | Original PNG bytes |
| ---------------------- | -------------------------------: | ----------------: | -----------------: |
| `route-worlds-ukraine` |                            8,405 |         8,825,887 |          8,814,876 |
| `route-worlds-retro`   |                            8,307 |         7,589,633 |          7,578,780 |

Run from the repository root, using new output directories:

Each cache output contains `descriptor.json`, `pack.json`, `media.rlmedia` and
`inputs.json`. Output must be a new directory beneath this worktree's `.cache`,
with ordinary directory parents. Existing outputs are refused. The generated
binary pairs are not duplicated in tracked source. `--record` derives the proof
and three descriptors only when all four destinations are absent; it refuses
overwriting an existing qualification record.

## What the proof establishes

[routes.json](routes.json) derives every one of the 38 pinned FPV input traces in
each edition: **114 contexts, 84 wins, 30 failure controls, 91,620 ticks and 114
saved continuations**. This covers both immediate and grid-center turning, with
72 Standard and 42 Gentle contexts. No route is synthesized by editing live
state, adding waits or inventing success flags.

Every run checks the original geometry, complete stock roster, physical result,
configuration and future-affecting checkpoint sections against its source trace.
Only the separately verified edition identity and the identity fields embedded
in the terminal result differ. Full new-identity replay verification and full
checkpoint equality are still required. A real unfinished prefix is serialized
through the current `xonix-session.v4` API with the exact theme/body, original
picture pin and explicit null story. Restore verifies that campaign and pin,
resolves the saved original, and replays the remaining ordinary inputs to the
identical final checkpoint and replay bytes. The source proof, prior pack and
original art are read without mutation.

Tests reject missing/duplicate/relabelled route contexts, altered physical or
saved-picture evidence, malformed proof candidates, accessor side effects,
foreign media pairs and unsafe output destinations. Passing those checks is
source/core/replay qualification. This folder does not register a host chapter,
change the optional catalog or default campaign, migrate any embedded pack,
install into a profile, or establish native Choose/Collection/backup/offline,
browser, public delivery, phone/controller or human enjoyment acceptance. Those
are separate integration gates for the exact descriptor and payload hashes.
