# Civic courtyard composition — separate source study

This revision concentrates on one middle-terrace courtyard instead of adding more empty land. The existing 384 m town gains two open market bays, a supported civic clock marker, perimeter benches, and different supported rooftop silhouettes and façade pilasters on the two buildings framing the approach. It reuses the exact CC0 Kenney Building Kit columns and palette already documented in `../source-provenance.json`; the additional architecture is original geometry. No new texture, decoder, runtime module, or appearance default is added.

The accepted `town-r2` source, immutable delivery and Library identity remain unchanged. Running the generator without a variant reproduced all 41 original files byte-for-byte. The new explicit `courtyard-r3` variant has its own paired manifest revision, and has no installed/default entry.

## Reproduce and verify

Run from the repository root with a new output directory:

```sh
node authoring/fpv-worlds/regions/hillside-town/prepare.mjs /external/new-courtyard courtyard-r3
node authoring/fpv-worlds/regions/hillside-town/verify.mjs /external/new-courtyard courtyard-r3
node authoring/fpv-worlds/regions/hillside-town/verify-commanded-flight.mjs /external/new-courtyard
```

The first two commands require the existing authoring dependencies, including `gltf-validator` for verification. They never modify the target after verification or write player storage.

## Evidence and limits

- 18 canonical GLBs passed validation; 152 licensed placements retain original UVs, indexed palette pixels and explicitly reversed back faces.
- 10,626 production support/collision queries cover the old streets, 0.5 m low ramp passes, all original doorway/pad openings and new arcade/marker features. Roofs, counters, columns, marker and benches are solid geometry; the market aisle stays open.
- Nine authored routes passed the unchanged production command controller in Self-level and Acro (18 executions), plus eight disarmed authored starts and four roof/pad contact cases. There are no body teleports along a route.
- Source assets total 8,498,421 bytes. Scenery resources are 3,392,836 bytes, including the original 2,446,676-byte palette allocation. The retained/candidate bound is 7,698,488 bytes, within the existing 8 MiB limit. No budget increased.
- Production window replacement and explicit disposal returned all resource/reservation counters and collision worlds, colliders and bodies to zero.

The first orbit used short corners and failed the controller's corridor check. The physical route was redesigned with longer legs and a verified 2 m corridor away from structures; runtime tolerances and every previous route remain unchanged. Both attempts are preserved externally and `route-refinement.json` records the distinction.

Native pilot-eye appearance review is pending. This is a courtyard composition study, not proof of final town art quality, package/offline admission, sustained device performance or a larger world. Trees, broader district variety and final atmosphere remain separate work. The clock is static artwork, not a mission timer.
