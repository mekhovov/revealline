# Compatible world catalogues

`index.json` remains the `FPVWorldLibrary.v1` catalogue for the original Library
player. Every row there must import successfully in that retained player. Do not
add capabilities, runtime versions, or other row fields: its exact-key parser
would reject the entire catalogue.

`surface-coating-v1/index.json` uses the same schema, limits, immutable commit/path,
byte size and SHA-256 identity. Only players with the required
`REVEALLINE_surface_coating` version 1 capability request it. Their generated
dedicated worker accepts this exact index URL; immutable pack URL and hash checks
are unchanged. This catalogue lists Mountain Reservoir r16 and Festival Grounds r5; the original
catalogue remains empty. A world enters a catalogue only after its final pack,
courses, examples, presentation and installation are
qualified. A compatible world may appear in both catalogues; a coating-dependent
world must never enter the original one.

`ground-motion-v1/index.json` is the cumulative catalogue for players that also
support actor `groundMotion: 'support-v1'`. It retains the same closed row schema
and immutable pack checks. Only this capable player's dedicated worker accepts
the new index URL; older cached players retain their existing endpoints. Packs
requiring ground motion must never enter either older catalogue.

The ground-motion catalogue retains both eligible surface-coating rows unchanged:
Mountain Reservoir r16 and Festival Grounds r5. It additionally lists Harbor Docks
r4, whose two moving ground subjects require `support-v1`. The original feed
remains empty and the surface-coating feed remains unchanged. Preserve every
eligible row when extending a cumulative feed. Switching endpoints does not
update cached players or install demonstrations; examples remain separate proof
archive imports.

Catalogue versions select an existing, fixed capability contract. They do not
negotiate arbitrary imported features or permit executable content. Future
required features need another compatibility decision before publication.

An older cached player still rejects a directly imported pack whose required
coating or ground-motion feature it does not support. New players distinguish a
well-formed but unsupported required extension or ground-motion version from
malformed declarations. EN/UK guidance explains that the current SIM
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

Festival's second row pins the [qualified eight-course r5 pack](https://raw.githubusercontent.com/mekhovov/revealline/62d0e72f2963a61cc65ef829a320d9a1c2593b0c/authoring/fpv-worlds/festival-grounds/distribution/r5/festival-grounds.r5.rlpack)
to the merged #1097 content head, its exact 1,256,875-byte size and SHA-256
`87baca276e174f31ba19c02f4f2359c97affa07eefd4a5f4912b4d8664450f51`.
Reservoir's row and the original catalogue bytes stay unchanged. Festival does
not need Harbor's opt-in ground movement; it is eligible for the current
surface-coating player without requiring the ground-motion runtime.

Its [sixteen demonstrations](https://raw.githubusercontent.com/mekhovov/revealline/62d0e72f2963a61cc65ef829a320d9a1c2593b0c/authoring/fpv-worlds/festival-grounds/distribution/r5/festival-grounds.r5.proofs.json)
remain a separate explicit recording import. [The row receipt](evidence/festival-r5-library-row.json)
retains 37 checks of immutable HTTP bytes, strict catalogue parsing, current-main
pack import/roundtrip and all sixteen exact course/mode dependencies. It does
not repeat the existing complete-flight or native-browser qualification from
[Festival's content delivery](../festival-grounds/README.md). Protected row
publication and actual public Browse/download/install remain separate gates.
The first verifier run's child-process output-buffer failure is retained in
[its diagnostic receipt](evidence/festival-r5-row-harness-first-run.json).

Run `node authoring/fpv-worlds/published/qualify-festival-row.mjs NEW_RECEIPT.json`
with Node 22 to reproduce the bounded data qualification. This command refuses
to replace a receipt and does not build packages or generate flight proofs.
Any future cumulative feed must retain both eligible published rows; Harbor may
enter only its separately qualified ground-motion-capable cohort.

[Native Library review](evidence/festival-r5-library-native.json) additionally
verifies the pending two-row catalogue in the admitted `614adef` player: native
download and save, all eight Festival missions, scene preparation, explicit arm,
pause and retained installation after reload. The fixture replaces only the
pending catalogue response; immutable HTTPS pack download, hash validation and
atomic installation remain unchanged. No console warnings/errors were observed.
This is local integration evidence, not public catalogue publication, another
full-flight qualification, or a hardware/offline performance claim.

## Cumulative ground-motion publication — 13 October 2026

The newer player had switched to the ground-motion feed before Festival was
added to the older feed. This change restores Festival discovery for that player
and adds the already-qualified Harbor content. It changes only catalogue data,
not player, Worker, package, physics or recording bytes.

Harbor's [eight-course r4 pack](https://raw.githubusercontent.com/mekhovov/revealline/8af1b67220be4f26e9b68d821e2b574b63a23904/authoring/fpv-worlds/harbor-docks/distribution/r4/harbor-docks.r4.rlpack)
is pinned to its merged content commit: **879,213 bytes**, SHA-256
`d5bf4b9bb6829c04dbe1bb398893e5243cefc1f9acf018bf153a2012c8cf49b6`.
Its [sixteen demonstrations](https://raw.githubusercontent.com/mekhovov/revealline/8af1b67220be4f26e9b68d821e2b574b63a23904/authoring/fpv-worlds/harbor-docks/distribution/r4/harbor-docks.r4.proofs.json)
remain a separate import. Existing full-flight, native-browser and offline
qualification is recorded in [Harbor's content evidence](../harbor-docks/README.md).
The Library labels it **Harbor Docks / Портові доки**.

The [current data receipt](evidence/ground-library-three-worlds-20261013.json)
passes **84 checks**: all three immutable HTTP pack/proof pairs match their pinned
commits and main, all three packs round-trip without changed bytes, every one of
48 recordings names the exact pack/course/mode, and older feeds are byte-exact.
These are dependency checks, not 48 new complete-flight replays. The first run
caught a verifier assumption that Library and project titles must match exactly;
Reservoir intentionally has a longer project title. The check now preserves the
existing published labels and validates project identity independently.

Reproduce with
`node authoring/fpv-worlds/published/qualify-ground-library.mjs NEW_RECEIPT.json`.
The command refuses to overwrite evidence, bounds each download to 4 MiB and
does not build packages or generate proofs. Public Browse/download/install must
be observed after publication; this receipt alone does not establish live or
offline availability. Canals and the broader performance/reliability work remain
outside this catalogue increment.
