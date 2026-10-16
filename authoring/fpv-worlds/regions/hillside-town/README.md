# Hillside Town — original bounded source study

An original 384 × 384 m town uses three inhabited terraces at 0, 12 and 24 m, graded connecting lanes, open courtyards, 18 modular buildings and a separate elevated landing deck. The streets and doorway openings are intended flight routes, not distant decoration. This is a distinct authored layout, not a copy of another simulator’s map.

## Licensed input and presentation

The official [Kenney Building Kit](https://kenney.nl/assets/building-kit) page identifies version 1.0 and CC0. Its exact 1,598,905-byte archive hashes to `2740ef5772fb5fb3d7aab881db22d129f6b68afe711b1a79e6d5e9e19cf3eec6`. Selected original GLBs, the original 512 × 512 palette PNG, and License.txt are retained unchanged under `source`; each is pinned in `source-provenance.json`. The original archive and complete path/size inventory are preserved externally.

The [Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) primary page and [Kenney’s OpenGameArt upload](https://opengameart.org/content/fantasy-town-kit) also identify CC0. Version 2.0 archive was verified at 3,854,691 bytes / SHA256 `1a7530c09f4d2fa2cdee259876f089334f8b1f27fa86a0c4f54ef86cdd8676ef`. It is researched but **not used here**: medieval and modern modular styling stay separate, and a second large palette is not added to this residency budget.

The Building Kit is modular, not a complete town. Original opaque plaster/wood palette colours and UVs are retained; this is honest stylized material work, not photorealistic textures. Window-glass pieces use unsupported blended transparency and are excluded whole, rather than silently removing their glass. No materials are replaced by arbitrary flat colours. Original material double-sided semantics are represented by explicit reversed triangles and normals in authoring; no shipped renderer, source schema or decoder changes are needed. All player-facing collision stays solid for these architectural models.

## What is verified

- 18 canonical terrain/scenery GLBs: zero validation errors and warnings.
- All 144 licensed model placements retain exact palette pixels, UVs and triangle topology including the explicit back-face conversion; only documented scale/yaw/translation and millimetre quantization change geometry placement.
- Seven actual commanded routes in both Self-level and Acro: lower main street, graded ascent, courtyard turn, upper switchback, open-house pass, elevated-pad approach and below-pad pass. Four authored starts remain paused at tick zero before deliberate arm. Roof and elevated-pad contacts reject pass-through in both modes.
- Production swept collision checks cover the whole declared corridor width at all three quality tiers. The initial layout exposed a house intersecting the upper street and an elevated pad crowding the underpass; source placement was corrected without weakening flight, clearance or collision thresholds.
- Production window replacement and disposal checks verify geometry/texture/source/reservation and collider owners release to zero.
- Two fresh builds reproduce every generated source/scene/manifest byte.

The corrected `town-r2` region uses 876,240 geometry bytes plus one shared 2,446,676-byte palette allocation. Including terrain and a full retained plus candidate window, the conservative total is **7,558,648 / 8,388,608 bytes**. The closed terrain/scenery asset payload is **8,344,201 bytes**. Existing source, geometry, residency and package budgets are unchanged. No runtime module, Library row or accepted world revision changes.

## Road correction before native review

The first `town-r1` used horizontal 8 m road boxes sampled at each slab centre. Inspection identified up to 1.5 m floating/buried road edges on the 12 m / 32 m slopes. Its 5 m-high flight routes did not detect this presentation and low-flight defect. The original source and receipts remain preserved; `receipts-r2/original-road-regression.json` demonstrates the old support mismatch and low-pass contacts.

`town-r2` replaces roads and courtyards with closed ribbons whose top and bottom vertices follow the exact 4 m terrain lattice, including ramp breaks and cell boundaries. Every road top is 100 mm above terrain, with the base 20 mm below it; junctions share the same top height. Low-level production checks now sample both slopes and the courtyard edges at 0.5 m intervals in all three quality tiers: 2,994 support queries remain within 0.501 mm of the expected top, and 2,952 swept passes at 0.5 m above the road with 0.25 m radius remain clear. All original 14 commanded routes and eight authored starts still pass, as do solid roof/pad contacts and zero-owner disposal. The same corrected source is rebuilt twice byte-for-byte. Native review remains pending.

## Reproduce

From the repository root, using the existing authoring glTF validator dependency:

```sh
node authoring/fpv-worlds/regions/hillside-town/prepare.mjs NEW_EXTERNAL_DIRECTORY
node authoring/fpv-worlds/regions/hillside-town/verify.mjs NEW_EXTERNAL_DIRECTORY
node authoring/fpv-worlds/regions/hillside-town/verify-commanded-flight.mjs NEW_EXTERNAL_DIRECTORY
```

`verify-commanded-flight.mjs` reuses the established bounded command controller; it selects controlled scenario starts only, then advances real production physics without teleporting the body. Exact current manifests and command hashes are in `receipts-r2`; `receipts-r1` preserves the earlier source evidence.

## Remaining gates

Native pilot-height material/appearance review, visual composition refinement, a separately pinned immutable delivery, normal Library admission and exact package/offline checks are pending. This is not a finished town art standard, an unlimited world, or a large-city performance claim. It introduces no moving subjects and makes no real-device FPS or elapsed-flight claim.
