# Compatible world catalogues

`index.json` remains the `FPVWorldLibrary.v1` catalogue for the original Library
player. Every row there must import successfully in that retained player. Do not
add capabilities, runtime versions, or other row fields: its exact-key parser
would reject the entire catalogue.

`surface-coating-v1/index.json` uses the same schema, limits, immutable commit/path,
byte size and SHA-256 identity. Only players with the required
`REVEALLINE_surface_coating` version 1 capability request it. Their generated
dedicated worker accepts this exact index URL; immutable pack URL and hash checks
are unchanged. This catalogue lists Mountain Reservoir r16; the original
catalogue remains empty. A world enters a catalogue only after its final pack,
courses, examples, presentation and installation are
qualified. A compatible world may appear in both catalogues; a coating-dependent
world must never enter the original one.

Catalogue versions select an existing, fixed capability contract. They do not
negotiate arbitrary imported features or permit executable content. Future
required features need another compatibility decision before publication.

An older cached player still rejects a directly imported coating-dependent pack.
New players distinguish a well-formed but unsupported required extension from
malformed extension declarations. EN/UK guidance explains that the current SIM
cannot import the feature and directs the player to the existing Flight practice
launcher: **Check available practice → Play available version**. If that version
still lacks the feature, a compatible pack is required. **Prepare offline** caches
the version currently opened; it does not upgrade an old version. No import error
automatically navigates, clears caches, removes data, or strips a required feature.

The first row pins the [qualified eight-course Reservoir r16 pack](https://raw.githubusercontent.com/mekhovov/revealline/ea57d2e321896ab873c2ca6ca06791a88362a674/authoring/fpv-worlds/mountain-reservoir/distribution/r16/mountain-reservoir.r16.rlpack)
to its immutable source commit, 1,379,988-byte size and full SHA-256. In a capable
player, open Library, choose **Browse optional worlds**, then **Download**.
The row adds no bundled challenges, runtime assets or precached downloads.

The sixteen demonstrations are a [separate recording archive](https://raw.githubusercontent.com/mekhovov/revealline/ea57d2e321896ab873c2ca6ca06791a88362a674/authoring/fpv-worlds/mountain-reservoir/distribution/r16/mountain-reservoir.r16.proofs.json).
After the world is saved, use the ordinary **Import recordings / examples**
control to import it. Downloading the pack does not install these recordings;
the catalogue schema has no proof-download field. The editable ZIP and source
remain available from the [r16 distribution](../mountain-reservoir/distribution/r16/README.md).

[First-row verification](evidence/reservoir-r16-first-row.json) records actual
immutable HTTP bytes, exact import/pack round trip and the separate proof hash.
It also records the merged content and compatibility prerequisites. Protected
row publication, actual public Browse/download and the native update journey
remain distinct observations; this evidence does not claim they have occurred.
