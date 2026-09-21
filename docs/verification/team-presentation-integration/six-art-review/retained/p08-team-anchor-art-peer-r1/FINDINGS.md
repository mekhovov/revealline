# Team anchor production peer review

Reviewed the unapproved candidate at `.cache/p08-team-anchor-art-17bd1965-r1/candidate` on 2026-09-21. Scope: pixel contract, provenance and immutable reproduction; native visual acceptance remains the parent's separate work.

## Findings

1. **Source fingerprint defect identified and corrected during review.** The first producer hashed the caller's project-root source while executing a statically imported drawing module. That permitted unrelated source bytes to receive credit for the loaded code's pixels. The current successor captures the imported source once at module initialization and rejects a different project-root source before production. An independent alternate-source probe now rejects correctly.
2. **Manifest serialization mismatch identified and corrected during review.** The initial read-only check reported `Immutable Team anchor output differs: manifest.json`: prepared `pivot` objects were expanded, while `format(JSON.stringify(manifest))` collapsed them. The successor now formats `JSON.stringify(manifest, null, 2)`. A fresh Node 22.22.2 read-only check reproduces both PNGs and the exact prepared manifest successfully. `regenerated-manifest.json` retains the earlier differing serialization as diagnostic evidence only.

**No remaining blocking production-contract defect found in the reviewed successor.**

## Passed checks

- Independent PNG chunk parsing, CRC checks and decompression: both images are 24×24, 8-bit RGBA, noninterlaced, binary alpha `{0,255}`. Byte counts, hashes, opaque counts, palette lists and occupied bounds match the manifest. No extraneous PNG metadata chunks are present.
- Each image uses four approved palette colours; the shared family uses five. Both have 266 opaque pixels and 310 transparent pixels, centered declared pivots, and no pixels outside the declared frame.
- Both share their intended radio silhouette. Normalizing amber and cyan still leaves eight changed structural pixels in the connector, so the state distinction is not colour-only. Runtime labels/capture geometry are not baked into either asset.
- Manifest source hash matches the current source file. Provenance identifies original integer-pixel code without claiming image generation, sampled artwork or automatic production approval.
- Revised immutable writer preflights every output before creating any missing member. A seeded conflicting captured image prevents writing a missing available image; existing bytes remain untouched. Missing check-only output rejects. Fresh production followed by repeated production and check succeeds in peer scratch.
- Review-page labels and prompts describe the paired roles and require Relay Yard plus imported multi-stronghold review; First Connection is correctly identified as having no anchor role.

## Evidence and limits

`pixel-review.json` records independent decoded-pixel findings. `production-probe.json` records reproduction/failure tests. Scratch outputs exist only below this peer directory; no root or candidate was edited.

Suggested regression coverage: caller-source mismatch, source edit after module initialization, partial/conflicting output preflight, missing check-only output, exact generated manifest reproduction, and pair structure after normalizing accent colours. Pin the producer/toolchain when freezing a release, since byte reproduction also depends on the PNG encoder and manifest formatter.

No native canvas appearance, visual quality, uploaded collection adoption, full release gates or public deployment is certified by this review.
