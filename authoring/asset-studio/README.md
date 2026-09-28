# Asset Studio artwork candidates

Open [Asset Studio](index.html) over HTTP and use **Artwork collections · source
candidates** to import collection JSON together with every named image, or one
previously exported `.rlart` packet. This separate authoring draft does not change
the Studio's `.rltheme` workspace or register artwork for a mission.

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
