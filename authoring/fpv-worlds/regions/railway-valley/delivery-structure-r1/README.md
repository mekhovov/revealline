# Railway Valley — bounded structural preview

This immutable delivery contains the verified terrain/scenery pair from the Railway
structural study. It is **384 × 384 metres**, with nine cells and four authored
starting points. It is a preparation artifact for normal Library admission; this
commit alone does not make a new world visible in the game.

## Integrity and provenance

- Delivery: `FPVRegionalDelivery.v1`, `railway-valley-study`, `structure-r1`.
- Descriptor: 6,661 bytes, SHA-256
  `431b2dfb4be228e094174f1ccdd8eb72f906f09eb39a62c31b16e2bfb1239f15`.
- Payload: 38 files, 5,684,606 bytes (5,691,267 including the descriptor).
- Exact prepared source: `3794177fe`, structural source PR #1301.
- `source-provenance.json` records the Kenney Train Kit 1.1 archive and constituent
  sources. `License.txt` preserves its CC0 notice and additional credits.
- `preparation.json` records authored routes, openings and source-manifest hashes;
  `delivery-receipt.json` records the copied closure and runtime download check.

Original geometry surrounds licensed track and freight pieces. Source intake also
lists candidates blocked by unsupported quantization; those are not represented as
admitted models. No third-party simulator assets have been copied.

Only `delivery.json` and its 38 declared files are downloaded by the runtime. The
provenance, license and receipts beside them are review documents, not undeclared
runtime dependencies. The descriptor remains strict v1: presentation overrides must
be separately trusted by exact identity and descriptor hash.

## Verification and remaining admission

The normal regional downloader verified every declared byte/hash using a local file
response adapter. All payloads exactly match the independently prepared structural
source. The existing authoring verification passed deterministic closure, corruption,
UTF-8, traversal, paired identity/cell/spawn checks and existing-output preservation.
Its generic fixture uses an Urban descriptor identity; the actual Railway descriptor
above was separately checked by the runtime with its Railway identity.

Actual normal-host download/storage/flight, trusted presentation integration and
release qualification follow in focused changes. This artifact does not claim a
4 km region, finished scenery, moving subjects, device FPS or a two-hour flight.
Keep the current 64 MiB regional delivery cap and all existing game budgets.
