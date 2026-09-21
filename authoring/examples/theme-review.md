# Review a portable Studio theme before a release

Use this workflow to hand a community's exported `.rltheme` file to a maintainer without replacing the live game or its saved artwork. It requires a desktop filesystem and a supported Node.js runtime. Players do not need these tools to install or play published campaigns.

## Prepare the handoff in Studio

1. Select the intended theme and collection. Inspect its affected screens, exact slot requirements, provenance and original files.
2. Prepare each upload or sprite, supply its actual creator/source/rights, then **Validate and stage replacement**. Save the workspace locally. Technical validation produces a candidate; record review evidence only after actually reviewing it.
3. Export **.rltheme** and confirm the browser saved a file. “Download requested” is not proof that a file reached disk. Keep the previous export separately.
4. Record the filename, byte size, SHA-256, selected collection, intended compatible modes and pending review items alongside the file. The bundle retains earlier revisions and source originals.

For current sprite edits, inspect the prepared geometry before staging. **Edit current raster** loads its pixels; the generic preparation path currently starts pivot, rotor anchors and nine-slice from slot defaults. Reapply custom placement when necessary, especially after rotation or cropping. Earlier records remain intact. Retaining placement automatically is a separate open improvement.

## Validate and compile into a new review directory

From the repository root, using Node 20 or 22:

```sh
node scripts/compile-presentation.mjs --bundle "/absolute/path/community-candidate.rltheme"
node scripts/compile-presentation.mjs --bundle "/absolute/path/community-candidate.rltheme" --out .cache/community-theme-review-01
```

The first command validates and reports the source, revision, slot count and output-file count without writing a review tree. The second creates a **new** directory beneath the project's `.cache`. Choose a new name for each attempt. An existing destination is rejected; do not delete previous evidence just to reuse its name.

The output contains:

- `assets/`: the retained hash-addressed source and prepared files.
- `studio.json`: the complete editable document and history.
- `runtime.json`: the resolved presentation and local asset bindings.
- `theme.css`: compiled shared style tokens and font declarations.
- `manifest.json`: the output-file sizes and SHA-256 values.

Compilation checks manifest structure, file headers, hashes and budgets. It does not perform browser image/font/audio decoding or approve gameplay readability. CLI output uses compact formatting, so its JSON/CSS bytes can differ from formatted release files even when the parsed records and original payload bytes are identical. Verify a produced tree against **its own manifest**, not by assuming it equals an unrelated release directory byte-for-byte.

A malformed bundle fails before an output directory is created. If a filesystem failure occurs after creation, retain the partial tree for diagnosis and use a new destination after resolving the failure. Never point a review operation at a frozen release or overwrite the production ledger manually.

## Recover and review before adoption

In a separate fresh local Studio origin or profile, use **Import collection**, inspect the intended selected collection and earlier slot revisions, then Save and Reload. Bind an earlier approved revision and use Undo/Redo to confirm history remains usable. Export again and compare every original and prepared payload byte. Imported record IDs may be namespaced to avoid collisions; compare provenance and exact remapped parent references as well as visible names.

Inspect native-size artwork and real Solo, both Versus boards and Team contexts where compatible. Verify image decoding, English/Ukrainian fonts, sound audition and mute, geometry, responsive placement, keyboard focus and reduced effects separately. A bounded Studio preview is not a full gameplay qualification. A failed import or stale save must leave the existing workspace available.

After approval, a maintainer adopts the candidate through the [production process](../../docs/field-kit-production.md), retains the immutable production history and runs the [release verification](../../docs/asset-studio.md#release-verification). Uploading or compiling a file alone does not change the public game. New presentation defaults cannot replace saved or earned originals.

## Tested scope

The [retained qualification](../../docs/verification/p17-theme-review/README.md) uses the exact committed collection at source `8cffb36b29a38013eb9213845efd675c4864c9d8`. A fresh 79-file compiler module closure compiles its bundle of 133 asset payloads on both supported Node runtimes, verifies output manifests and exact original bytes, compares parsed runtime/history records, and refuses an existing output directory without changing it. This is an independent CLI trial, not a fresh full repository build or a completed browser/community-release journey.

Maintainer prompt: “Take the actual exported `.rltheme`, pin its bytes and source revision, compile into a new isolated cache directory, and verify every output against its manifest. Keep original payload bytes and complete history, reject corrupt input and existing destinations, then import/save/reload/re-export in a fresh Studio. Record native input, decoding, cross-mode play and public adoption separately; do not equate a generated directory with a released community theme.”
