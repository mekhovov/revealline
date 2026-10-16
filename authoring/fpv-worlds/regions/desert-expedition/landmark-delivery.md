# Desert Expedition landmark delivery

This preserves the accepted `landmarks-r1` source as a separate immutable regional delivery. The existing `natural-r1` delivery and Library pin are unchanged. This increment does not add a Library row or claim normal player admission.

The source is `c8ba03a56b77e04d64b376db7c8242bebb2d1ba0` from PR #1405. Its later main reconciliation preserved every landmark generator, view definition and verification file. All 2,048 original terrain payloads and the six starting poses remain byte-identical to `natural-r1`. The paired manifests carry the new revision and six populated scenery cells; the other 1,018 cells are explicitly empty.

## Exact delivery

| Item                          | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| Format                        | `FPVRegionalDelivery.v2`                                           |
| Identity                      | `desert-expedition-study` / `landmarks-r1`                         |
| Descriptor bytes              | 329,271                                                            |
| Descriptor SHA-256            | `fed1f7d18bfe3163cbb52b8b7ecd174a777b89a45ac962c181bd8ca11b727ea7` |
| Payload files                 | 2,062                                                              |
| Payload bytes                 | 47,835,247                                                         |
| Whole delivery bytes          | 48,164,518                                                         |
| Existing whole-delivery limit | 67,108,864 bytes                                                   |

The manifest hashes, byte counts and source identity are in `landmark-delivery-pin.json`. All payload files are in `delivery-landmarks-r1/`. The source remains 16.384 × 16.384 km on the existing 512 m lattice; six small compositions do not imply that the whole region is populated.

## License and transformations

Terrain and composition are original authored work in this repository. The 23 rock objects derive from loafbrr's CC0 [Canyon terrain asset](https://opengameart.org/content/canyon-terrain-asset). The exact upstream GLB and the preserved license/source receipt remain in `../canyon-badlands/source/`; its SHA-256 is `0b24bb22f0089767990d58401e516ec1853380eda6a33802036a377f8519d623` (945,596 bytes).

Only named visual mesh triangles are used. The generator centres, scales, rotates and quantizes them, replaces their colours, and generates render and collision payloads from the same positions and indices. Godot add-ons, collision proxy meshes, HDRI and upstream textures are excluded. See `landmark-study.md` and `prepare-landmarks.mjs` for the exact transformations. No preservation of upstream palette or shading is claimed.

## Verification

```sh
node authoring/fpv-worlds/regions/desert-expedition/verify-landmark-delivery.mjs authoring/fpv-worlds/regions/desert-expedition/delivery-landmarks-r1
```

The verifier uses the production downloader and flight session. It checks all 2,063 responses and exact hashes, compares the 2,048 terrain payloads and original starting poses with the preserved `natural-r1` delivery, prepares all six starts in Self-level and Acro, explicitly arms for 2,400 controlled climb ticks, checks zero contacts, and proves pause isolation and resource disposal. The source receipt separately covers 40,096 controlled-route ticks, deliberate rock contacts and 6,021 clearance sweeps; this short delivery check does not replace those route checks.

The exact frozen source passed native authoring review on 2026-10-15: all six compositions loaded, the rocks were visibly grounded, openings were readable, and Release reported no live scenery or collision. Maximum local geometry was 491,616 bytes. The review accepts bounded structural composition, not final representative art. Receipt: https://github.com/mekhovov/revealline/pull/1405#issuecomment-6189224857.

## Remaining gates

The broad terrain remains sparse and visually simple. A normal Library entry, persistent installation, fresh launch and cached launch need their own exact package/native qualification. This delivery does not establish physical-device FPS, full-region endurance, final realism or hours of varied authored content. The existing natural revision remains available throughout that later admission work.
