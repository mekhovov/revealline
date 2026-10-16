# Railway Valley expanse: immutable delivery preparation

This source-only increment packages the reviewed 4,096 × 4,096 m Railway Valley recipe from `4c252d9364fc13d518f24bd34aad6b7541a28889` (PR #1363). It does not replace the existing 384 m Railway world, add a Library row, alter flight behavior or qualify finished artwork.

The immutable candidate is `authoring/fpv-worlds/regions/railway-valley/delivery-expanse-r1/delivery.json`:

- Delivery identity: `railway-valley-expanse`, revision `review-r1`, explicit `FPVRegionalDelivery.v2`.
- Descriptor: 98,773 bytes, SHA-256 `38bddc6a19c8ba5965992b68ed9b80398cb515dc99de7ce07cac11c9436606c7`.
- Complete payload: 618 files / 17,844,865 bytes. Descriptor plus payload: 17,943,638 bytes, below the unchanged 64 MiB allowance.
- Terrain manifest: `71f1330ce107aecd34adef19041c6f48c5492bb0ea1b668d147e4a148f108b69`.
- Scenery manifest: `b94730367c57670d8844007bff2953c05e282f5ac29352cf7914d25041bfe642`.

Every source payload and both manifests remain byte-identical to the reviewed recipe. The terrain has 256 cells; scenery explicitly names 52 populated and 204 empty cells. Empty means declared empty in the pinned manifest, never a missing file. Six authored starts and all source geometry remain unchanged.

The exact source preparation receipt was compared against the committed recipe receipt before packaging. The existing strict delivery builder verified hashes and complete paired closure before creating a new output directory. Its source blob matches the one in the source recipe. All 619 copied descriptor/payload files were independently hash-compared after copying into this branch.

## Production verification

`verify-expanse-delivery.mjs` exercises the production downloader with local file-backed responses. It verifies the exact descriptor, all 619 responses, every payload hash, monotonic progress, complete sparse coverage and expected extent. It then constructs sessions using only the returned verified bytes, with no source/network fallback.

All six starts are prepared in both Self-level and Acro: 12 cases remain disarmed at tick zero, accept explicit arm and 100 real shared-flight ticks without contact, pause without accepting further input, and dispose with zero owned geometry, textures, source bytes or reservations. This is short functional command evidence, not an internet throughput or native rendering measurement.

The check was run against unchanged extracted modules from the independently qualified `a07c0a9c36e2e0af4cda3a5a53a45573ba2712e8` cloud package. Only the authoring scenario’s two production import paths were redirected outside the package. The committed raw receipt identifies the source recipe and records the complete delivery pin and all 12 cases.

Reproduce from a complete checkout:

```sh
node authoring/fpv-worlds/regions/railway-valley/verify-expanse-delivery.mjs authoring/fpv-worlds/regions/railway-valley/delivery-expanse-r1
```

The retained train primitives are from the previously accepted CC0 Kenney Train Kit source. The parent recipe retains the original source and license provenance; no proprietary simulator assets were copied. See `authoring/fpv-worlds/regions/railway-valley/source-provenance.json` and `source/License.txt`.

## Remaining acceptance

This draft is not player admission. Native visual quality, materials and landscape polish, actual player route review, a trusted Library entry, exact combined package qualification and deployment remain separate. It does not claim moving trains, scored missions, complete-world endurance, hardware controller coverage, device FPS, native IndexedDB installation or offline playback. Existing saved Railway revisions remain available and unmodified.
