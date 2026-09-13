# Route Choices in three worlds

These source-only Tactical editions pair nine original reward pictures with the
three existing [FPV Route Choices](../fpv-route-choices/README.md) layouts. Ukraine
Atlas, 1994 Forever and Spend Network each receive a distinct campaign, map and
poster identity. They reuse the same three geometries; this is **not nine new
layouts**. They are teaching/challenge candidates with the existing fixed grades,
not an enjoyment or difficulty certification.

| Layout reused | Tactical choice                                                               | Ukraine Atlas           | 1994 Forever      | Spend Network  |
| ------------- | ----------------------------------------------------------------------------- | ----------------------- | ----------------- | -------------- |
| Foundry       | Two exits around a warned interceptor; the direct route is a failure control. | Two Lanes, One Forge    | Midnight Workshop | Value Foundry  |
| Depot         | Time the carrier field, or take the longer route without equipment.           | Crosswind Market Depot  | Crosswind Courier | Shared Harbor  |
| Switchback    | Compare signal-resistant travel and cable exposure with the safe rim.         | Carpathian Thread Relay | Signal Thread     | Network Garden |

These are abstract game rules, not representations of battlefield tactics,
historical equipment or financial/product behavior. Their manual ability routes
are Tactical-only. This addition makes no Arcade completion claim and changes no
existing primitive, class roster, difficulty rule, music track or story. The
scenery is independent of collision geometry.

## Exact originals and separate payloads

[editions.json](editions.json) pins the full provenance records and ordered
original assignments from [Ukraine art](../ukraine-route-art/README.md),
[retro art](../retro-route-art/README.md) and
[Spend art](../spend-route-art/README.md). Those folders retain the generated PNGs,
exact prompts and provenance. Small pseudo-letter decorations and the other
recorded visual qualifications remain as documented there; these are fictional
scenes, not copied product interfaces or authenticated historical illustrations.

The compiler checks the existing full PNG signature/chunk CRC/decompression/RGB
decoder, exact original SHA-256, byte size and dimensions. It does not crop,
resize, recompress or otherwise transform those files. Each presentation uses
`contain`, `nearest`, revision 1 and `story: null`.

| Edition                | Compact normalized gameplay JSON | Paired `.rlmedia` | Original PNG bytes |
| ---------------------- | -------------------------------: | ----------------: | -----------------: |
| `route-worlds-ukraine` |                            8,614 |         8,825,996 |          8,814,876 |
| `route-worlds-retro`   |                            8,516 |         7,589,742 |          7,578,780 |
| `route-worlds-coupa`   |                            8,526 |         8,281,102 |          8,270,167 |

The compact pack contains no inline image or dependency. Its exact paired media
file includes the three originals, presentation assignments and retained owner.
The existing `revealline-external-chapter.v1` validator checks the complete pair
before returning a prepared value. Descriptor hashes are in
[ukraine.json](descriptors/ukraine.json), [retro.json](descriptors/retro.json) and
[coupa.json](descriptors/coupa.json). Existing embedded readers and the 48 MiB
pack/index and 256 MiB managed-store caps are unchanged.

Run from the repository root, using new output directories:

```sh
mkdir -p .cache/route-worlds/outputs
node authoring/library/route-worlds/build.mjs ukraine .cache/route-worlds/outputs/ukraine
node authoring/library/route-worlds/build.mjs retro .cache/route-worlds/outputs/retro
node authoring/library/route-worlds/build.mjs coupa .cache/route-worlds/outputs/coupa
node authoring/library/route-worlds/verify.mjs
node --test game/test/route-worlds.test.mjs
```

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
