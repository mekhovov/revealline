# Verified regional terrain windows

`createVerifiedTerrainWindow` connects the existing source loader to detached terrain
preparation. It is an **authoring-only** coordinator: `flightReady` remains false,
there is no player host integration, and no existing physics/proofs/package change.

## Exact-source binding

The coordinator privately creates `createRegionSourceWindow`. Callers supply a region
manifest, a source directory URL and transport/budget options. They cannot supply an
alternate loader, preparation callback, decoded terrain objects or replacement mesh.
The manifest is detached and frozen by the existing validator.

This stage accepts a narrow terrain profile: each chunk has exactly one collision JSON
(up to 16 KiB) and one scene GLB (up to 64 KiB), with no textures or scenery. It rejects
incompatible declarations before fetching. The loader bounds bodies and verifies exact
length/SHA-256; credential omission and redirect rejection remain in force.

For each required cell, the coordinator decodes the copied verified collision bytes
with strict UTF-8, applies `FPVRegionCollision.v1`, and checks the declared chunk id and
coordinates. It compiles that exact lattice and compares the result byte-for-byte with
the verified scene GLB. Even a valid GLB with changed geometry/material/metadata fails:
this version admits only canonical output from **FPV regional terrain compiler v1**.
No arbitrary GLB parsing, texture decoding or executable source is introduced.

The detached renderer and isolated Rapier queries are built from those checked lattice
values. Neighbour seam checks still run; individually valid hashes do not prove seams
match. Source hashes prove byte identity, not legal rights: author/license receipts and
content review remain separate requirements before a map can be published.

## Transactions and ownership

`transition(positionMm, supportPose?)` copies and validates its target before replacing an active
request. Invalid targets leave the existing request alone. A successor cancels prior
source work and waits for its cleanup before preparing new resources. Generation checks
run after source loading, between bounded cell decodes and after asynchronous engine
preparation. Stale resources are disposed rather than committed.

The API exposes:

- `snapshot()` with readiness, retained-resource/budget counters and a detached source
  provenance receipt (region/revision, target/origin, chunk asset URLs/bytes/SHA-256).
- `group` for the current detached authoring preview; initially null.
- `support` and `sweep` delegated only while state is `ready`. During loading,
  cancellation or failure they return `not-ready`, even if an old preview is retained.
- `cancel()` to stop the current operation without destroying the previous preview.
- `dispose()` to cancel pending work, release both source and decoded resources and
  reject further transitions/queries. Repeated disposal is safe.

A successful transaction publishes its complete prepared window and provenance together,
then disposes the previous window. Any failure leaves the previous preview and its
provenance intact, but readiness stays false until a successful transition. The source
loader may already have committed new verified bytes when geometry validation fails;
those bytes are private and never relabel the retained terrain's provenance.

The optional support pose is a copied strict object with integer `positionMm` and a
`radiusMm` from 1 to 2,000. The movement prototype supplies its current body foot
position and hull radius. The coordinator checks downward support on staged terrain
before publishing it or disposing the previous group. A missing or higher supporting
surface rejects the successor and retains the previous visual frame/provenance with
readiness disabled. This is a narrow pose admission check, not a caller callback,
replacement terrain, collision solver or certification that the surrounding hull is clear.

## Bounded work

The source loader still prepares its bounded source neighbourhood, including optional
prefetch. Decoded terrain is restricted to the required 3×3 neighbourhood (at most nine
cells). Only one preparation runs at a time. Old committed plus new staged geometry
arrays must fit the shared 2 MiB allowance, which can be lowered but not raised. Each
cell contributes 50,712 position/index/normal bytes. The budget is checked before the
successor fetch; insufficient allowance preserves the old preview and fails closed.

Source copies are handled one cell at a time, each limited to 16 KiB collision plus
64 KiB scene. Compiler output and validated JSON objects are additional bounded
allocations. Reported geometry/source counters do not measure object overhead, Rapier
internals, GPU uploads or total browser memory. No FPS or long-session memory claim is
made. Missing-neighbour and conservative shape-boundary behaviour is unchanged from
[terrain preparation](fpv-regional-terrain.md).

## Verification

```sh
node authoring/fpv-worlds/regions/verify-verified-terrain.mjs
```

Twelve manual scenarios use native fetch against local HTTP plus shipped Three/Rapier:
exact-source preparation/provenance, malformed JSON/UTF-8/identities, transport hash
corruption, canonical GLB mismatch, valid-but-discontinuous terrain, retained previews
on failure, superseded requests, cached-source cancellation, combined-budget failure,
profile rejection, pending disposal, repeated transitions and pre-commit support-pose
rejection/mutation isolation. These are functional
fixtures, not live player flight, hardware/GPU or license acceptance. Additional unit
coverage remains in D6.

Next: production asset provenance and quality, scenery/overhang collision, bounded
GPU preparation, atomic live-world installation/removal and full-state origin migration,
unscored regional free-flight integration, offline recovery and flight qualification.
