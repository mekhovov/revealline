# Reproducible sprite candidates

This source-authoring CLI creates small PNG candidates from explicitly selected square RGBA8 originals. It does not change the game, register a runtime asset, alter a collider or overwrite an original. Full-resolution artwork and its provenance remain in `authoring/library/`.

Use this after inspecting the original orientation, full frame, alpha and attachment positions. The compiler preserves the frame; it cannot recognize an incorrect drawing, repair baked propellers, invent an animation rig or certify visual quality.

## Export and verify

Create a JSON specification with `size` (32, 64 or 128) and 1–56 `sources`. Every source needs a stable candidate `id`, repository-relative PNG `path`, exact `bytes`, lowercase SHA-256, `width` and `height`. Sources must be square, non-interlaced RGBA8 PNGs, at most 2048×2048 and 4 MiB each. Different entries must have different IDs and paths.

```json
{
  "size": 128,
  "sources": [
    {
      "id": "scout-body-review-v1",
      "path": "authoring/library/my-theme/originals/scout.png",
      "bytes": 123456,
      "sha256": "REPLACE_WITH_ACTUAL_64_CHARACTER_SHA256",
      "width": 1254,
      "height": 1254
    }
  ]
}
```

The sample is a template, not a valid or produced asset. Use actual inspected source identities. Create an ordinary parent directory and choose a new output directory under `authoring/library/` or `.cache/`:

```sh
node authoring/sprites/cli.mjs compile --root . --spec authoring/library/my-theme/sprites.json --out authoring/library/my-theme/review-v1
node authoring/sprites/cli.mjs verify --root . --manifest authoring/library/my-theme/review-v1/manifest.json
```

Compile checks every source before creating the output directory. It refuses an existing output directory and symlink components. An interrupted filesystem write may leave a partial candidate directory; there is no automatic deletion or overwrite. Use a new directory for a subsequent attempt. The manifest is written last. Verify regenerates all files from the pinned originals and current tool source, compares the complete manifest and PNG bytes, and refuses missing or extra files. Keep inspection screenshots outside the exported directory.

## Exact pixel and encoding recipe

For each output pixel `(x,y)`, take all four source channels at:

```text
sx = floor((2*x + 1) * sourceWidth  / (2*outputSize))
sy = floor((2*y + 1) * sourceHeight / (2*outputSize))
```

No cropping, thresholding, palette conversion, blending or gamma transform occurs. The recorded pivot is the full-frame center and the expected orientation is north. These are export assumptions, not measured mechanical anchors or game metadata. Transparent pixels retain their original RGB channels. Full source metadata remains on the original; the new PNG carries only IHDR, IDAT and IEND.

PNG output uses RGBA8, filter 0 on every row, a fixed zlib header, uncompressed DEFLATE blocks of at most 65,535 bytes, and explicit Adler-32/PNG CRC checksums. It does not depend on a system compression library or browser Canvas encoder. A 128×128 output is 65,737 bytes; fourteen total 920,318 bytes, excluding manifests. This byte arithmetic is not a measured saving in a shipped game.

The manifest records original identity, output byte and decoded-pixel identities, recipe and hashes of the compiler, decoder and CRC source. Production timestamps are absent from deterministic bytes. Keep the exact tool revision to reproduce older cohorts; changing its source requires a new reviewed cohort. Verify is intentionally stricter than merely checking that a PNG loads.

## Acceptance before runtime adoption

- Compare originals and candidates at 16/20/24/32/56/128 CSS pixels over black and revealed artwork, at several headings. Check thin blades, alpha fringes and padding. Two-stage downsampling can differ visibly from drawing the original directly.
- Inspect independent body/rotor/wing/warning layers and reduced-motion behavior. A static export does not fulfill those animations.
- Record parent/output identities and keep the original body ID, appearance choices, earned/save references and collision geometry unchanged.
- Add a separately tested versioned runtime adapter. Image pools, cancellation, override precedence, vector fallback and Guide/gameplay consistency must remain intact. Ordinary builds should copy approved bytes, never generate unreviewed artwork.
- Recompute actual offline, package and Pages sizes after integration. Do not raise budgets or silently download the originals as a fallback.

No new runtime derivatives are included with this tool-only change. Existing historical releases are untouched. See the Character Collection skill and the feature-delivery workflow for integration/release gates.
