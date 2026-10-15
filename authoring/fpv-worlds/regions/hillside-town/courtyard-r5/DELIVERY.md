# Civic court materials — immutable courtyard-r5 delivery

The closed `FPVRegionalDelivery.v1` descriptor publishes the bounded source appearance accepted in #1431. Both manifests and all source/scene bytes are copied exactly; earlier courtyard-r4 and town-r2 sources and the existing Library pin remain unchanged.

- Identity: `hillside-town-study`, revision `courtyard-r5`.
- Descriptor: 6,579 bytes; SHA256 `f6717cb5833932f4ab1be27705802ba0600384e0f4fc2f4d0e2e8f4b06bdf573`.
- Closed inventory: 38 files / 8,660,487 bytes, or 8,667,066 bytes including descriptor, below the unchanged 64 MiB limit.
- Terrain manifest: `cb8604a0f175a11e9ec4202d25dadd33313e798d6268e6750d91ed32bd662388`.
- Scenery manifest: `dee66643576dd3413ade268408f049affb9da15a3b63c187779ab802015faeda`.
- Existing conservative retained/candidate resource bound: 7,893,944 bytes / 8 MiB.

`verify-courtyard-delivery.mjs` uses the production downloader, verifies exactly 39 responses and the complete immutable closure, then builds eight production sessions (four authored starts × Self-level/Acro) using only verified bytes. Arm is rejected before prepare; each session starts paused at tick zero with zero input, permits an explicit arm, climbs for 200 actual simulation ticks without contacts, pauses and ignores subsequent input. All owned resources and a separately inspected terrain/scenery collider owner return to zero on disposal. The receipt is `delivery-verification.json`.

```sh
node authoring/fpv-worlds/regions/hillside-town/verify-courtyard-delivery.mjs
```

The adjacent original license and provenance preserve the CC0 Kenney Building Kit attribution; derived original patterns do not replace the licensed source files. This is source publication, not Library admission. Native player installation/selection, exact packaged runtime and offline qualification remain separate. The accepted comparison is an incremental courtyard material improvement; sparse surroundings and white floors remain and representative final-art quality is still open.
