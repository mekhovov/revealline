# Coastal settlement composition study

This follow-up preserves the 768 × 768 m, six-district terrain and adds a more coherent village street. Five huts replace the earlier two-building composition; a fifth palm marks the slalom return, and ten grass clusters define the dune passage. The twelve existing authored flight lines and six starting points remain intact. The original district revision and the first 384 m installed coast remain reproducible and unchanged.

This is still an early composition study. Broad empty areas, flat visual water, limited architectural variety and the larger archipelago remain unresolved. Five huts are an incremental improvement, not a claim that the representative final world-quality standard is complete.

## Budgets and rejected iterations

No runtime, collision, texture or delivery limit changes. An initial eight-hut placement exceeded the existing 1 MiB source limit in its cell and was rejected. A subsequent extra-palm placement exceeded the existing 512 KiB generated scene allowance and was rejected. The accepted source uses five huts and five palms in their respective cells instead of widening either limit.

The final exact source totals 7,857,157 bytes across 38 manifest/dependency files. Its complete region uses 4,025,228 resource bytes, conservatively 8,050,456 bytes for full retained and candidate windows, below the unchanged 8,388,608-byte ceiling. This leaves 338,152 bytes of resource headroom; further composition must respect that constraint. Textures remain shared resources, while mesh placements still contribute geometry and solid collider costs.

## Verification

Reproduce from the existing immutable, welded RGBA Tropical intake:

```sh
node authoring/fpv-worlds/regions/tropical-coast/prepare-coastal.mjs /path/to/rgba-assets /new/settlement settlement
node authoring/fpv-worlds/regions/tropical-coast/verify-coastal.mjs /new/settlement /new/settlement/preparation.json
node authoring/fpv-worlds/regions/tropical-coast/verify-commanded-flight.mjs /new/settlement /new/settlement/preparation.json
```

`settlement-preparation.json` pins both manifests. The receipts retain exact source identities and outcomes:

- 18 canonical GLBs, no validator errors or warnings.
- 24 existing quality-tier collision probes and 27 window replacements; all resource/collider ownership disposed to zero, source bytes unchanged.
- 24 production-session routes across both flight modes, 96,020 fixed ticks in total; 12 disarmed authored starts and six negative contact scenarios. Every body movement after scenario initialization comes from stick commands, with no body teleporting or relaxed tolerances.

Transparent foliage remains visual-only, while trunks, huts, piers and cargo remain solid. No physics, water interaction, runtime module, default Library row or package budget changes are included.

## Provenance and pending admission

The unchanged models/textures derive from Ron Kapaun / 3TD Studios' CC0 Tropical pack. The verified intake and prior district documentation retain upstream URLs, archive and source hashes, licenses and derivation details. Terrain, arrangement and routes are original project work.

Native appearance acceptance, an immutable delivery descriptor/source publication, a trusted Library revision and package/offline qualification are separate gates. Source checks alone do not admit this revision to players, establish real-device performance, or complete the broader world-quality target.

## Native source review — 15 October 2026

Root inspected exact `districts-r2` on isolated origin 9069 using the same frozen production runtime `83fd65256336da0fb892bec3c12678ce537576c3` as the preceding district review. Balanced Village from both sides, Palms and Dunes rendered correctly; no error/warning console entries were observed. Explicit Dispose returned collision ownership to zero. The five huts are visible and have a better street relationship than the previous two-building layout.

This accepts the **scoped composition improvement only**. Native inspection still found visually sparse areas, broad flat green surfaces, isolated grass and flat water. It does not complete the representative final art standard. The next pass should integrate ground paths, courtyards and shoreline treatment and review the result from pilot eye level, rather than simply add more models or empty acreage.

The exact source remains `terrain=3946fc2ffed922dadc171e609753c63590ef3daade337c04395b6356612448a5`, `scenery=ba0339e6e3f8285169a4f10fe1dc456de2fab36632496412b9a7104a6e1ae4c9`. The preserved screenshot is `coastal-districts-r2-village-20261015.png`; native source acceptance does not change any Library entry or package/offline claim.

## Immutable source publication

The strict `FPVRegionalDelivery.v1` descriptor and exact 38-file closure are preserved under immutable source commit `9f7fbbccf00e94c62cb51c9111dbf2b2ec13235c`, at `settlement-delivery-review-r2/delivery.json`. Descriptor size is 6,609 bytes and SHA-256 is `dab4be6dd5b782d38c6c01f510137d048b9646d1f14e80c4dc40c6d848720f49`. The production delivery API fetched all 39 remote responses, verified both manifests and every dependency, and prepared the complete closure. The remote receipt states its scope explicitly: this is not native installation, a Library pin or package admission.
