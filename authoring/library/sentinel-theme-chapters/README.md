# Sentinel Circuit theme chapter candidates

This compiler pairs the nine [Sentinel theme originals](../sentinel-theme-art/README.md)
with the three existing [Sentinel missions](../sentinel-circuit/README.md), creating
independent Ukraine Atlas, 1994 Forever and Spend Network Tactical editions.
There are **three reused layouts and zero new geometries**. The older FPV edition,
all original images and its saved/earned owners remain unchanged.

| Theme         | New chapter ID             | Authored campaign key                         |
| ------------- | -------------------------- | --------------------------------------------- |
| Ukraine Atlas | `sentinel-circuit-ukraine` | `sentinel-circuit-ukraine/1/2c5a77757c64c4d1` |
| 1994 Forever  | `sentinel-circuit-retro`   | `sentinel-circuit-retro/1/e8edd91a796a9b65`   |
| Spend Network | `sentinel-circuit-coupa`   | `sentinel-circuit-coupa/1/8459eb3ba67608e6`   |

[editions.json](editions.json) explicitly maps every theme and mission role to
one full art cell ID, source level ID, original path/hash, scenic title and
briefing. It is checked against the pinned provenance from art commit
`80c26921ebd023354453d9aee7b62d47b7673ee8`. Wrong theme/cell/path/hash mappings
refuse before compilation. New level, asset and presentation IDs are scoped to
their new chapter. None is inferred from the first available image or a matching
map name.

The builder reuses `buildSentinelCircuit`, its fixed source pack and bounded
ordinary-file reader. It changes theme, owner IDs, titles and explanatory text.
The theme's existing display labels describe memories/Winter bloom,
cartridges/Mainframe or opportunities/Complexity hub. Scout information,
Light carrier's temporary field and Fiber relay's signal resistance remain the
same abstract class mechanics. Every wall, spawn, rule, actor, objective,
equipment field, signal band and encounter timing is compared to the source.
The last mission still has one encounter with shielded and exposed schedules.
Three missions do not mean three internal boss phases.

The real pack, still-media, `.rlmedia` and external-chapter validators prepare
each pair. All nine original PNG byte streams are retained; none is resized,
reencoded or embedded in gameplay JSON. Each exact authored presentation uses
`contain`, `nearest` and literal `story: null`. Existing theme music and all seven
class recipes are reused. This adds no finished music, animation or story movie.
Invented geography, textile motifs, decorative emblems and instrument marks keep
the qualifications in the art provenance.

## Compiler API and exact outputs

```js
const world = await buildSentinelTheme('ukraine');
// { descriptor, payloads: { pack, media }, prepared, sourcePack,
//   inputPins, imageProofs }
await writeSentinelTheme('ukraine', '.cache/new-ukraine-sentinel-pair');
```

`validateSentinelThemeEditions(document, provenance)` is a pure source-metadata
check. Its return value is not a decoder or ownership capability. The compiler
reads the fixed provenance by its exact hash, fully decodes each bounded PNG,
and returns the real prepared external chapter. No codec, catalog or database
authority is granted by an unverified JSON shape.

| Descriptor                          | Compact gameplay bytes | `.rlmedia` bytes |
| ----------------------------------- | ---------------------: | ---------------: |
| [Ukraine](descriptors/ukraine.json) |                  9,440 |        8,175,624 |
| [Retro](descriptors/retro.json)     |                  9,404 |        7,553,086 |
| [Spend](descriptors/coupa.json)     |                  9,427 |        7,416,321 |

Each descriptor pins both bodies by exact bytes and SHA-256, the authored
campaign key and all three original poster records. The nine original PNGs total
23,108,412 bytes; the six pair bodies total 23,173,302 bytes. This is payload size,
not installed free space. The existing 4 MiB still, 48 MiB pack/index, 256 MiB
committed-plus-staged media and row/count limits remain unchanged.

The explicit producer writes `descriptor.json`, `pack.json`, `media.rlmedia` and
`inputs.json` to a new ordinary cache directory. Existing directories, symlink
parents and destinations outside the worktree cache refuse. From the repository
root:

```sh
mkdir -p .cache
node authoring/library/sentinel-theme-chapters/build.mjs ukraine .cache/ukraine-sentinel-pair
node authoring/library/sentinel-theme-chapters/verify.mjs
```

No site build, startup generation, download or database write occurs here.
`verify.mjs --record` exclusively creates the initial three source descriptors
and compact proof; it refuses existing outputs and explicit caller candidates.
Normal verification is read-only.

## Source proof and authority boundaries

[routes.json](routes.json) references the exact retained base trace file and its
SHA-256. Each record identifies a source route and hashes its inputs; it does
not duplicate the source segment or event arrays. The verifier nevertheless
executes every input through the real core and compares all physical summaries,
checkpoint sections, events, metrics and unfinished-prefix state to that base.
Only explicitly derived edition identity fields differ.

The three themes execute 168 contexts under Standard/Gentle and both turn
policies: 96 wins, 48 controls ending after an actual life loss and 24 unfinished
early/short-closure controls, totaling 305,139 ticks. Every context saves an
actual unfinished cut, serializes/restores the current session with its exact
authored still and null story, verifies the full replay, and produces an
identical restored suffix. Compact receipts retain the new owner/picture pin
and checkpoint, replay, metric and saved-document hashes. These repeated theme
contexts do not count as new routes or geometries.

The dedicated test also performs real Ukraine and Retro wins, records their
independent first-earned metadata, round-trips the library, and refuses a saved
run or completion supplied with the other theme's owner capability. Resolving a
saved Ukraine picture against the Retro library returns unavailable, with no
generic or current-assignment fallback. This is pure core/library validation,
not native Collection or original-storage acceptance.

Initial local diagnostics are retained in the worktree cache: a new level
rights note exceeded the existing 160-character field limit and was shortened;
the first focused run passed eight of nine cases, with the last failing because
its new test named `external-chapters.json` instead of the existing
`external-worlds.json`. Neither required a shared runtime change.

Runtime registry/catalog/build admission, native install and separate Choose,
active-run preservation, Collection, original recovery, backup/offline and
public/device acceptance remain separate integration work. Existing embedded
packs and historical owners are not migrated or replaced. These candidates are
outside the frozen v0.36.0 source and do not complete the larger content target.
