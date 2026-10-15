# Civic court materials — derived source study

This source-only revision treats the two existing buildings framing the middle courtyard as a warm limewashed civic house and a muted green market house. Restrained stone plinths, a quiet timber band, terracotta roof joints and darker timber roofing add pilot-height material cues. The existing facade windows, planters, stalls, open market aisle and real doorway geometry remain unchanged.

The original CC0 Kenney Building Kit files and courtyard-r4 source are retained. A derived copy of the existing shared 512 × 512 indexed atlas uses only previously unused palette entries and a middle strip not addressed by the original licensed UVs. All original UV footprints, including a broad gutter under either image vertical convention, preserve exact RGB. Only fourteen bindings on the two buildings receive new UVs. Distant mip appearance can change and requires native comparison; this is not a claim of perfect image equivalence at every distance.

No player renderer/profile, physics, source schema, Library pin, asset decoder or budget changes. All 204 collision surfaces retain identical IDs, colors, positions and triangle indices. Geometry remains 1,043,888 bytes and the single shared texture remains 2,446,676 bytes. The existing retained/candidate ceiling remains 7,893,944 bytes, below 8 MiB.

## Reproduction and evidence

```sh
node authoring/fpv-worlds/regions/hillside-town/courtyard-r5/prepare.mjs /external/preserved-r4 /external/new-r5
node authoring/fpv-worlds/regions/hillside-town/courtyard-r5/verify.mjs /external/preserved-r4 /external/new-r5
node authoring/fpv-worlds/regions/hillside-town/verify-commanded-flight.mjs /external/new-r5
```

The baseline must match the exact reviewed r4 scenery manifest `e1d00292e1e98b9e99d325b398ec6ac7d07b2fcad73dc78417b305938c99e4b9`. Verification passes 18 canonical GLBs, 725,760 protected texel comparisons, exact geometry/normal preservation, three quality-tier production prepare/disposal paths and all eighteen commanded routes in Self-level/Acro plus eight disarmed starts and four roof/pad contacts. The separate repeated generation reproduces all 38 terrain/scenery files exactly. No test uses body teleporting or weaker thresholds.

The first nearest-existing-palette prototype is preserved externally; it quantized intended plaster tones to blue/peach. The revised atlas reserves unused palette entries for the authored tones while retaining original used pixels. No original source was overwritten.

Native original/revised same-camera appearance is pending. This is a bounded material improvement, not completed representative town quality, a realistic environment, a new Library admission, a device FPS claim or a broader landscape upgrade. The unchanged surrounding terraces remain sparse.
