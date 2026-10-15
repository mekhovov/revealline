# Desert Expedition Library admission draft

This focused draft prepares the immutable `natural-r1` pin as **Desert Expedition —
16 km relief study**, with EN/UK copy describing the actual 16.384 × 16.384 km
terrain, six landscapes and six authored starts. It does not describe a finished
populated world or claim hours of tested play.

## Exact source

- Delivery commit: `2ccdf059d9d0d55c6eb7e668da6cee9496288255` (#1389).
- Descriptor: 327,361 bytes; SHA-256
  `6ecb919762a9d3fac6519ca80600489cab0cb6b3cb3e0804d01d5f7e8791029d`.
- Payload: 2,050 files and 47,556,515 bytes; descriptor plus payload:
  **47,883,876 bytes**, below the unchanged 64 MiB delivery ceiling.
- Terrain: original 32 × 32 grid of 512 m cells; explicit empty sparse scenery.
- The immutable delivery contains the original terrain, not a resized copy of
  Canyon. Source/delivery verification remains in #1378/#1389.

## Safe capability and appearance gates

This branch starts from main `7de653d8dee104a9cf04c88efab355a9301eebab`, whose
runtime supports only 128 m and 256 m cells. The new row is included only when
the runtime's existing `REGION_CELL_SIZES_MM` lists 512 m. Consequently this
draft cannot advertise an unloadable map on the older runtime. The separately
reviewed capability #1372 remains a prerequisite; its explicit grid/origin
bounds must land before actual Desert Library qualification.

The entry intentionally has no trusted appearance override. Exact and unknown
revisions remain Plain until the opt-in Desert surface in #1390 passes native
review and is integrated through the exact immutable id/hash mapping. Merely
publishing the pin must not silently opt players into unreviewed artwork.

All existing main catalogue rows remain unchanged. The parallel Hillside #1388
and forthcoming Coaster rows are independent additions and must be retained when
reconciling the final combined Library. No module-count or byte ceiling changes
are needed for this row.

## Checks and remaining release gates

```sh
node authoring/fpv-worlds/regions/desert-expedition/verify-library-pin.mjs /path/to/delivery-natural-r1
```

The verifier checks the exact descriptor pin, whole delivery size, source grid,
current-runtime eligibility, safe Plain appearance, and all five prior main pin
identities. On an older runtime it confirms the actual production downloader
rejects after the descriptor and two manifests, before any terrain asset; the
UI does not offer that row. Once 512 m is supported, the same check performs the
full 2,051-response production download against the exact immutable payload.

Both paths passed during preparation. The positive path was a **composed source
check**, loading only the exact `region-manifest.mjs` from capability commit
`cf9d2b3a9170ad6e240b1d29a486b7ef4afcd965` into this main-based verifier. Its Git
blob was checked as `ba7fc056d507cb4c8ea631a24914e97649a6be0d` before execution.
That read-only composition verified all 2,051 responses and eligibility; it is
not an exact package, native player launch or runtime integration receipt.
See `library-verification.json` for both bounded results.

Keep this PR Draft until the dependency is integrated and a fresh coherent
package includes the capability, this row and the finally accepted appearance.
Then qualify archive/import/budget checks, normal Library download/install/Fly,
saved-row reload, explicit arming/pause, six starts and the origin-unavailable
journey. Neither a hidden-row old-runtime package nor an authoring preview is
evidence of normal player admission. Device FPS and finished-art acceptance
remain separate gates.
