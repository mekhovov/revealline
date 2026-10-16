# Asset Studio artwork candidates

Open **Workshop → Theme Studio** in the game, or the dedicated
[Theme Studio view](index.html?studio=themes), to create and manage themes. It uses
the same editor, workspace database and native exports as Asset Studio. Returning
to Workshop restores the Theme Studio entry for the current game edition.

The open component specimen uses the same live material-preview component as the
player theme selector. **Explore built-in themes** loads an interactive comparison
of every built-in theme: buttons, material states, fields and telemetry controls.
These sample controls do not change your game appearance or workspace. The
component recipe inspector and runtime/SIM previews remain available alongside
them. **Open asset tools** leads to the shared asset inventory for editing source
assets and theme tokens.

The **Theme library and specimens** workbench keeps independent theme workspaces.
**New industrial theme** starts from a flattened snapshot of the verified current
release, preserving original asset bytes and provenance without copying its full
editing history. **Duplicate** instead snapshots the selected workspace. Import
can preserve a workspace identity, duplicate it, or explicitly replace it while
keeping a recoverable prior workspace.

The normal `.rltheme` export retains editable workspace history and source files.
The separate `.rlruntime` export contains one selected compiled Presentation,
an independently identified `ThemeFamily.v1` and `InterfaceTheme.v1` candidate,
and its exact built-in SIM collection descriptor. Workspace color tokens drive
the candidate interface; SIM model/material/effect bindings refer to procedural
resources supplied by the installed engine. The export does not claim to bundle
those resources or install an arbitrary player theme. Its `RLRUN2` envelope has a
SHA-256 integrity check and exact asset hashes; the reader also accepts older
Presentation-only `RLRUN1` files without inventing cross-domain bindings. These
checks detect changed bytes, not authorship or approval.

**Compare industrial arcade art** uses the current workspace's exact selected
asset bytes in both real Team renderers. Only recognized built-in artwork receives
the Industrial appearance adapter; custom uploads remain authored. Editing or
switching workspaces closes the comparison until it is explicitly opened again.

Save staged edits before **SIM World Studio**. The same-tab calibration preview
receives a bounded, single-use candidate through session storage, valid for 30
minutes. It shows the candidate interface and canonical built-in SIM collection;
it does not change player preferences, flight proofs or world geometry. Reloading
the preview consumes no second payload; reopen it from Asset Studio to review
that candidate again.

Open [Asset Studio](index.html) over HTTP and use **Artwork collections · source
candidates** to import collection JSON together with every named image, or one
previously exported `.rlart` packet. This separate authoring draft does not change
the Studio's `.rltheme` workspace or register artwork for a mission.

To inspect a retained revision, select its exact artwork ID and choose **Compare
retained parent**. Studio follows the packet's explicit parent relationship and
shows both files with their collection revision, dimensions, medium and SHA-256.
For the revision 7 community packet, `poltava-revised-r6-wide-r7` compares with
`poltava-revised-r6`; selecting that revision 6 image compares with
`poltava-original`. File names never choose a parent. Original images without a
declared parent have no comparison.

**Fit whole image** keeps each complete image visible. **Native pixels · scroll**
uses one image pixel per CSS pixel in bounded, keyboard-scrollable frames; browser
zoom and device scaling can still differ. The views share this display choice,
not a resize or crop. Only the chosen parent is additionally decoded. Hiding the
comparison, replacing its selection or leaving the page releases that resource;
late or cancelled decodes cannot restore it. A back/forward-cache return leaves
comparison off. These controls do not change packet revisions or exported bytes.

To prepare a board image:

1. Select a retained artwork with the `reveal` role. Its original bytes, SHA-256
   and decoded dimensions must pass validation.
2. Choose **1152 × 576** (wide) or **768 × 576** (classic). These are PNG output
   dimensions; the operation never changes a mission's logical board.
3. Choose **Fit** to retain the complete picture with ink-colored letterboxing,
   or **Centre crop** to fill the frame by removing outer edges symmetrically.
   Neither stretches the image. A fitting choice that requires upscaling fails.
4. Choose **Create board candidate**, then inspect the separately selected result.
   Pixel-art declarations use nearest-pixel sampling; photographs use smooth
   sampling. Review the actual output at native size before considering adoption.
5. Export the collection as `.rlart` before leaving. It retains the original and
   derivative bytes and their parent relationship. Reimport that packet to recover
   the same accepted files; regenerating a PNG is not a byte-identical recovery.

The collection permits **16 total artwork files**, including retained originals
and derivatives, **4 MiB per file** and **32 MiB combined payload**. Creating a
derivative needs a free file slot and byte budget. A failure, cancellation or stale
completion leaves the accepted collection intact. No remote reference image is
fetched to prepare it.

Each candidate records its actual PNG byte count, dimensions and SHA-256, the
retained parent, fitting rectangles, sampling choice and native Canvas PNG
encoder. Native encoders can differ between browsers; identical options do not
promise identical PNG hashes. Rights, creator and source declarations remain
attached to the parent and derivative.

Preparation is not production approval or automatic pixel-art cleanup. Generated
cultural scenes still need deliberate native-grid cleanup, palette/edge review
and review of the depicted cultural details. Resampling alone cannot establish
that quality. Runtime binding and release review remain separate.

See [Artwork collection packets](../../docs/artwork-collection-packets.md) for
the exact policy, validation, provenance and lifecycle contract, and
[community scene candidates](../library/community-art-cohort-v1/README.md) for the
retained source cohort.
