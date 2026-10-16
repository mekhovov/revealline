# Coaster Gardens immutable review delivery

15 October 2026. This packages the source-only 2.048 km study from #1382 without changing any generated terrain, scenery or collision byte. The original 160 m Coaster pack remains unchanged. This is not a Library entry or public player admission.

## Pinned source

Source recipe: `fed0f01b89c7abadcf21508e6921509cc46546a7`. The source preparation and independent repeat were byte-identical across all 185 files. Source provenance, CC0 licence and the eight accepted models remain recorded beside that recipe; the two rejected models are not placed.

- Terrain manifest: `e8b0d7ebd1d3e0501d07eea8c4f7f61700da28667afee6e7d95f84ee101e6f36`.
- Scenery manifest: `be355ce2f5233691763b9afc9b474c9a9fa1bbae756363327ef4b3c678644cc7`.
- Delivery format: `FPVRegionalDelivery.v2`, identity `coaster-gardens-study`, revision `review-r1`.
- Descriptor: **29,654 bytes**, SHA-256 `4800da2f8a06134333fad8def9615a96c94b2fb76f7fb3ef41bfa69b4a9872b5`.
- Payload: **182 files, 33,878,943 bytes**. Descriptor plus payload: **33,908,597 bytes**, within the unchanged 64 MiB delivery envelope.
- 64 terrain cells, 26 populated scenery cells and 38 explicit-empty scenery cells. No dummy geometry or missing-file fallback.

The complete source tree is committed under `authoring/fpv-worlds/regions/coaster-park/delivery-review-r1/`. A later Library change must pin `delivery.json` at the exact immutable commit URL and the descriptor identity above. It must not use a branch URL.

## Completed verification

`verify-expanse-delivery.mjs` runs the actual production downloader and regional session. The committed receipt records all **183 responses** with exact lengths/hashes, monotonic byte progress and a closed cache-only session source. All six starts prepare disarmed in Selflevel and Acro; twelve short 100-tick commanded climbs, pause retention and zero-resource disposal pass. The descriptor, all manifest references and every payload are verified before a session uses them.

This is a filesystem-backed HTTP-response fixture. It does not measure internet throughput, native rendering or elapsed endurance. The larger source checks in #1382 remain separate: canonical render/collision identity, seams, corridor sweeps and actual commanded traversals.

```sh
node authoring/fpv-worlds/regions/prepare-delivery.mjs SOURCE NEW_OUTPUT coaster-gardens-study review-r1
node authoring/fpv-worlds/regions/coaster-park/verify-expanse-delivery.mjs NEW_OUTPUT
```

Both source and bundle outputs are preserved externally. The delivery builder refuses to overwrite an existing output. No runtime code, package closure, physics, scores, existing recordings or budgets change in this PR.

## Still required

Native visual/art review of the six districts, any resulting source refinement, a separate normal Library row, exact combined package installation and cached/offline acceptance, and physical device/controller verification remain outstanding. The four-kilometre content target is not complete; this intentionally remains a connected two-kilometre study rather than an empty enlargement.
