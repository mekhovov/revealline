# Original actor source preservation — 2026-09-29

## Disposition

Preserve three previously local-only authoring collections in one source-only
change. This is **not runtime adoption, a new playable edition, production asset
approval, or a public release**. No actor registry, compiled presentation, map,
production manifest, version, build configuration, collision rule or release
workflow is changed.

The user requested review and GitHub intake of remaining local work. The UX owner
assigned this bounded intake to the Levels lane, with actor adoption remaining
dependent on the existing actor/edition integration work, including PR #761.
Queue this preservation input with the existing v0.150.0 reconciliation train if
accepted by the publisher. Do not allocate a separate game version or hold a
playable fix for these candidates.

## Exact sources

| Collection           | Source commit                              | Files | Logical bytes |
| -------------------- | ------------------------------------------ | ----: | ------------: |
| Retro player bodies  | `fbd314d7190c81e2ff67981e9006c49993d35d43` |    32 |     6,203,631 |
| Spend helper bodies  | `ac6837d28317f42ffc832516d1ab1a9a6cd5754c` |    34 |     4,064,649 |
| Ukraine enemy bodies | `53d553485b8d7dc0f912959892947819a19d9803` |    34 |     6,914,706 |
| Total                | Three unchanged authoring subtrees         |   100 |    17,182,986 |

The twenty-one PNG originals total 15,938,572 bytes. Their original prompts,
per-role provenance, historical inspection boards and receipts are preserved.
Every donor file is retained at its original repository path with the exact Git
blob, length and SHA-256 recorded in [manifest.json](manifest.json). The receipt
is based on current main `b5ab06e12542f72e33c45b973ba693a5e1509c1c` and contains
no deletions or modifications of existing files. Original local branches and
worktrees are not removed or rewritten.

## Verification performed

- Independently reviewed the three exact donor diffs and their full path scope.
- Compared all 100 Git blob identities and byte lengths; parsed every retained
  JSON file.
- Matched all 21 original PNG hashes and sizes, and all 21 prompt hashes, against
  the per-role provenance.
- Checked text for accidental credentials; none were found in the bounded scan.
- Verified that the new commit contains only the three allowlisted authoring
  prefixes and this intake document/manifest. Existing runtime and release trees
  are unchanged.
- Checked new intake document formatting and Git whitespace. The historical
  donor files are preserved byte-for-byte, not reformatted.

No new media generation, image transformation, fresh visual acceptance, game
build, gameplay test, performance run or physical-device test was performed.
Long suites were not run and are not represented as passed. Source preservation
does not qualify these bodies for runtime use.

## Limitations retained, not silently repaired

- Provenance describes fresh text-only image generation without reference image
  pixels. This is evidence about the recorded process, not a blanket legal
  rights determination. No explicit asset-license grant is present in these
  collections; do not label them CC0 or public domain.
- Historical provenance includes the developer's absolute local paths, image
  identifiers, filesystem inodes and localhost references. These are retained
  source provenance, not portable runtime addresses.
- Spend's public Coupa documentation informed vocabulary only. Preserve the
  explicit disclaimer that these are not official Coupa/Navi mascot designs or
  copied product interfaces.
- Ukrainian ornament is an original, Ukrainian-inspired art direction, not a
  claim that the invented motifs are authenticated historical patterns.
- Source README references to old bases, workspaces and release holds are dated
  history. They do not override this intake's current disposition.
- The static originals contain documented alpha fringes, inconsistent padding,
  many colors and compact-readability limitations. They are not articulated
  animation rigs and must not enlarge gameplay collision footprints.
- The historical inspection boards require a separate `/scene.png` route. That
  reveal-picture dependency is not copied here, and the boards are not shipped
  game pages or self-contained playable previews.

## Remaining adoption gates

1. Actor/edition owners choose which candidates to retain, revise or reject.
   Preserve the static sources even if no candidate is selected.
2. Confirm rights/attribution policy before production distribution; define
   runtime derivatives, memory budgets, pivots, visible bounds, animation and
   movement-facing readability.
3. Integrate selected successors through registered immutable actor/edition
   identities. Preserve current actors, original editions and user preferences.
4. Validate contrast, warning states, compact sizes, reduced effects, unchanged
   contact geometry and the actual frozen public build in the relevant modes.

The single publisher owns merge ordering, any release allocation and public
delivery. A milestone or merged preservation PR alone is not player delivery.
