# Industrial roster v3: identity-matched equipment destruction

This batch completes the signature-equipment handoff from the approved overhead roster to its defeat presentation. It is available only through the explicit `industrial-roster-v3` presentation revision. Gameplay recipes, simulation randomness, historical artwork revisions and published defaults are unchanged.

## Shared identity

`game/hunt/industrial-soldier-kit.mjs` contains the original live accessory rectangles, anchors, material tags and palette roles for all twelve families. The live overhead renderer and overhead/native defeat renderers now consume this same immutable data. Native 3D rigs use the same kit identity and material binding through their separate builder.

| Family          | Signature accessory | Material    |
| --------------- | ------------------- | ----------- |
| Lookout         | Binoculars          | Optics      |
| Patroller       | Bedroll             | Cloth       |
| Runner          | Harness             | Cloth       |
| Sprinter        | Headset             | Electronics |
| Courier         | Satchel             | Canvas      |
| Guard           | Equipment pouches   | Cloth       |
| Refuge seeker   | Shelter roll        | Cloth       |
| Switchback      | Scarf               | Cloth       |
| Rendezvous pair | Radio               | Electronics |
| Shield bearer   | Front plate         | Armor       |
| Brace trooper   | Brace pack          | Armor       |
| Relay warden    | Command pack        | Electronics |

All three existing casts and clean, bloodless brutal and bloody treatments retain this identity. Each defeat drops one signature accessory, alongside the established neutral or body-fragment recipe. The batch does not claim an articulated body-part simulation or new explosions for equipment that cannot explode in native gameplay.

The shared overhead pool retains its page-wide 128 transient pieces and four burst envelopes, with 24 settled clusters per board. Flight reuses its existing 128-instance fragment pool, 48-instance settled pool, four burst envelopes and twelve retained catch records. A multi-rectangle native accessory consumes several existing instances; it does not receive a separate allowance. Partial decorative detail is omitted if the pool is full. All of these resources remain separate from collision and gameplay state.

## Review sheets

The transparent [Field kit](soldier-debris/soldier-debris-v3-tactical.png), [Worn field kit](soldier-debris/soldier-debris-v3-rivals.png) and [Winter kit](soldier-debris/soldier-debris-v3-arcade.png) sheets show all twelve families in the table order. The three column groups are Clean, Brutal without blood and Brutal with blood. Within each group, the real renderer draws a 32px live actor, the contact burst at 0.22 seconds and settled feedback at native logical scale. Some image viewers display transparency as black.

These are offline samples from the actual procedural renderers, not alternate artwork. The [receipt](soldier-debris/receipt.json) pins source hashes, sample rectangles and PNG hashes. Reproduce with:

```sh
node scripts/produce-soldier-debris.mjs docs/qualification/industrial-art/roster-v3/soldier-debris
```

This batch adds zero decoded runtime atlas bytes. The three review PNGs are documentation assets, not gameplay downloads.

## Compatibility and verification

- Extracting the kit geometry preserves every previously reviewed live specimen. Regeneration into an ignored temporary directory produces a byte-identical 29,228-byte roster PNG (`2144926b77e07e92d94403b381192dbef2d344497869af547dbeca46d328e7b6`) and 62,389-byte animation descriptor JSON (`3168eb1dca2c97db2a01d4f2f9065c0188e75b1932da7b424c1e051255a913de`). The existing historical receipt is retained; future producer receipts also hash the new shared kit source.
- Scoped Node 22 checks passed 49/49 across the new kit cases, existing flight Hunt, machinery, actor catalogue and private-room presentation. The eight new cases also passed on Node 20. No cases were skipped.
- Coverage includes all 12 families × 3 casts × 3 treatments, unchanged historical/null/unknown revisions, actual native-flight contact, shared two-board budgets, clean settled gear, independent remains, pause, Reduced effects, setting reductions, replay seeking, repeated events, silent restoration and resource disposal.
- The native-flight regression uses accepted course controls and real collision/model transactions. It catches the distinction between a catch's pre-step timestamp and the completed snapshot's incremented tick. Fresh effects are admitted only by accepted native events and exact renderer-owned v3 actor IDs.
- Scoped ESLint, Prettier and diff whitespace checks passed.

An initial synthetic fixture missed the native tick increment and was replaced with a real flight-contact regression before qualification. A first settled-gore case also exposed the old recipe's equipment slot falling outside its four settled pieces; the v3 recipe now reserves its first existing piece for the kit. Historical recipes retain their previous behavior.

These checks establish software behavior and source continuity. Native 3D flight viewpoints, actual device performance, full-motion visual review and expanded chapter adoption still require their separate qualification evidence. The original roster evidence's limitation about generic equipment is superseded by this batch for explicit v3 contexts only.
