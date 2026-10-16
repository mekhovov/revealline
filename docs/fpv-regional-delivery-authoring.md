# Immutable regional delivery preparation

The authoring builder creates a closed `FPVRegionalDelivery.v1` bundle for the
regional Library lane. It does not admit a region to the default catalogue, change
WorldPack formats, award proofs or install anything in player storage.

The first candidate is the original Urban mixed-geometry review used in the
regional host and continuous-flight verification. It is a 384 × 384 m study,
not a finished large-world or realistic-art release. Later Urban artwork must be
published as a new immutable revision.

## Candidate

- Delivery identity: `urban-earthworks-study`, `review-r1`.
- Descriptor: `authoring/fpv-worlds/regions/urban-bando/delivery-review-r1/delivery.json`.
- Descriptor bytes: **6,615**.
- SHA-256: `1ba27d2242d61d61c0552564d75baa5f3e313e63a78c2ef434f63cdc7dbab94c`.
- Closed payload: **38 files, 1,455,090 bytes**, including both manifests.
- Both source layers remain byte-identical to `urban-mixed-r2`; the existing
  source manifest revision is `mixed-r1`. The delivery revision is independent.
- Geometry is authored by this project; this candidate adds no third-party assets.

Consumers pin the descriptor URL to a full immutable Git commit and verify its
byte length and hash before following its file inventory. The URL is not embedded
in the descriptor, avoiding a self-referential commit hash. A moving branch URL is
not an immutable catalogue pin.

## Reproduce

```sh
node authoring/fpv-worlds/regions/prepare-delivery.mjs \
  SOURCE_URBAN_MIXED_R2 NEW_OUTPUT urban-earthworks-study review-r1
node authoring/fpv-worlds/regions/verify-delivery-preparation.mjs \
  SOURCE_URBAN_MIXED_R2 EXTERNAL_SCRATCH
```

The source must contain `terrain/region.json` and `scenery/region.json` and every
local dependency they declare. The output directory must not exist. The builder
validates both canonical manifests, matching grid/spawn sets, safe case-unique
paths, positive bounded lengths and every source hash before creating output.
It copies exact source bytes and emits a deterministic descriptor. Existing output
is never overwritten. An interrupted filesystem copy can leave a partial new
directory; it has no descriptor until all payload writes finish and is never an
installed revision.

Limits: 64 MiB payload, 8 MiB per manifest, 1 MiB descriptor, 8,194 files. These are
delivery bounds, not permission to enlarge the game core or regional resident
budgets. Runtime verification must independently enforce the same closure and
limits before an atomic install; trusting this authoring receipt is insufficient.

## Verification and remaining gates

The real 38-file pair regenerated with identical descriptor and payload hashes.
The functional verifier also rejected a changed asset before writing output,
different paired spawns, traversal, invalid identity and existing destination;
it retained an unrelated sentinel file in the existing destination.

Remaining: independent runtime descriptor acceptance, atomic download/install,
offline retained-byte loading, normal Library launch through the shared paused
host, explicit removal and update recovery, exact packaging, then deliberate
catalogue admission. Native device/FPS and final art acceptance remain separate.
