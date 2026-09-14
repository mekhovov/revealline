# Fracture Lines theme chapter candidates

These source compilers pair the existing [Fracture Lines layouts](../fracture-lines/README.md)
with nine original reward illustrations for Ukraine Atlas, 1994 Forever and Spend
Network. They reuse **three layouts**, preserving every source level ID, wall,
spawn, seed, rule, class recipe and legal input route. Scenic changes create three
separate campaign owners; they add no geometry family or difficulty mode.

| Theme         | Owner                    | Original art and replacement guide               |
| ------------- | ------------------------ | ------------------------------------------------ |
| Ukraine Atlas | `fracture-lines-ukraine` | [Ukraine art](../fracture-ukraine-art/README.md) |
| 1994 Forever  | `fracture-lines-retro`   | [Retro art](../fracture-retro-art/README.md)     |
| Spend Network | `fracture-lines-coupa`   | [Spend art](../fracture-coupa-art/README.md)     |

[editions.json](editions.json) maps each complete art cell, source level ID and
exact original path/hash to its scenic title and description. The three art
provenance documents are fixed source inputs. Wrong themes, owners, cells,
paths, hashes or additional fields refuse before compilation. The older base
and [FPV illustration edition](../fracture-lines-chapter/README.md) remain separate
owners with their original saved and first-earned contexts.

The nine original PNGs are 1,774 × 887 and total 25,383,697 bytes. The real pack,
still-media, `.rlmedia` and external-chapter validators prepare each pair. Full
bounded RGB decoding and chunk CRC checks authenticate the exact original
bytes; nothing is resized, reencoded, stretched or embedded in gameplay JSON.
Each presentation uses `contain`, `nearest` and literal `story: null`.

Scenery is a reward illustration, not a collision map or historical
reconstruction. The provenance retains larger foreground figures, fictional
objects and stylized markings; the Spend middle greenhouse island has no visible
connecting bridge. Existing theme music is reused. No finished music, animation,
story movie, actual product interface, endorsement or financial result is added.

## Exact producer and proof

```js
const world = await buildFractureTheme('ukraine');
// { descriptor, payloads: { pack, media }, prepared, sourcePack,
//   inputPins, imageProofs }
await writeFractureTheme('ukraine', '.cache/new-ukraine-fracture-pair');
```

`validateFractureThemeEditions(document, provenances)` is a pure metadata check.
It does not grant media or owner capability. The builder reads each fixed
provenance itself and prepares the exact bodies through the normal validators.
The existing 4 MiB per still, 48 MiB packs/index, 256 MiB committed-plus-staged
media, and row/count limits remain unchanged.

The explicit producer writes `descriptor.json`, `pack.json`, `media.rlmedia`
and `inputs.json` only to a new ordinary worktree cache directory. Existing
outputs, symlink parents and paths outside that cache refuse. From this worktree:

```sh
mkdir -p .cache
node authoring/library/fracture-theme-chapters/build.mjs ukraine .cache/ukraine-fracture-pair
node authoring/library/fracture-theme-chapters/verify.mjs
```

The [Ukraine](descriptors/ukraine.json), [Retro](descriptors/retro.json) and
[Spend](descriptors/coupa.json) descriptors pin both body sizes and SHA-256 hashes,
the campaign key and all three exact poster records. Large paired bodies stay
in the cache; only these small descriptors and [routes.json](routes.json) are
source artifacts. The six pair bodies total 25,448,150 bytes; this describes
payload size, not available installation space.

| Owner                    | Compact gameplay bytes | `.rlmedia` bytes |
| ------------------------ | ---------------------: | ---------------: |
| `fracture-lines-ukraine` |                  9,311 |        8,734,108 |
| `fracture-lines-retro`   |                  9,393 |        7,967,075 |
| `fracture-lines-coupa`   |                  9,345 |        8,718,918 |

`verify.mjs --record` exclusively creates the initial three
descriptors and proof, refusing existing outputs or an explicit candidate.
Ordinary verification is read-only and snapshots caller input before awaiting.

The verifier executes all 48 retained Standard/Gentle route contexts and six
separate gameover controls for each theme, using only cardinal/neutral commands
and both turn policies. It compares every physical checkpoint section, exact
level ID, replay input, outcome, event and metric to the pinned source trace.
Only the approved display fields and owner-derived Gentle revision are
normalized; each new replay is independently verified with its own revision.
Every recorded boundary serializes/restores a current v4 session with its exact
new execution key, still and null story, then reproduces the unchanged remaining
input suffix and full replay byte-for-byte.

The recorded proof passes 144 route contexts: 72 ordinary wins, 36 controls
ending after an actual first life loss, and 36 recovered wins. The separate
18 gameover controls bring the total to 365,826 ticks. All 612 saved boundaries
restore exactly: 576 have nonempty suffixes and 36 are endpoint restores.
These are actual verifier outputs, retained with the raw qualification logs.
Repeated executions of the same controls are verification contexts, not new
routes, geometries or human playtesting. The dedicated test also earns a real
first picture for the base, FPV and each theme owner, retains earlier receipts,
round-trips metadata and rejects cross-owner saves/completions despite matching
level IDs. An absent exact original resolves unavailable without legacy fallback.
These are core/library checks, not native Collection or storage acceptance.

The first Node22 batch passed six of seven cases, including the complete proof
matrix. Its new first-earned test incorrectly assumed an empty library already
had a picture-receipt array. The correction treats that absent initial field as
an empty list while retaining every ownership and prior-receipt comparison.
The original failure and corrected checks remain in the cache receipt.

## Later adoption and prompt notes

This source slice adds no app registry, catalog card, distribution dispatch,
core cache entry, runtime storage operation, public release or production count.
Later adoption must bind all three descriptors and paired bodies explicitly,
then separately qualify Download, Choose, saved-flight/earned recovery and public
delivery. Do not infer installation from a matching level name or image.

For replacement art, start with the mission's enclosure, branching bays or
island crossings, then write a concrete scenic story with a distinct palette,
time and material culture. Keep the same native aspect; request original art
without interface text and inspect the actual default output. Retain full
prompts, exact bytes and candid deviations. Never treat painted bridges or
architecture as the playable geometry, silently replace an earlier original,
or reuse its saved-owner/hash pins for new bytes. Follow each linked art guide
before proposing a separately reviewed new edition.
