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

This branch was rebased onto main `740116d53ada0fecfd5398357e1df19801edf274`,
which includes merged capability #1372, its explicit grid/origin bounds and
the reviewed Desert material foundation #1390. The
new row remains included only when the runtime's `REGION_CELL_SIZES_MM` lists
512 m, so backports cannot advertise an unloadable map on an older runtime.

Only the exact immutable region ID and descriptor SHA select the Desert
appearance; unknown hashes or mismatched IDs remain Plain. All three player
quality settings map to the corresponding existing material tier without
changing the verified manifest. Parent native review accepted all six starts
and three surface tiers at `6d817cef58ecc717ccae2ef107f6e76a738bc547` as a
material foundation only. The reconciled material retains that exact Desert
implementation and preserves concurrent Tropical work.

All existing main catalogue rows remain unchanged. The parallel Hillside #1388
and forthcoming Coaster rows are independent additions and must be retained when
reconciling the final combined Library. No module-count or byte ceiling changes
are needed for this row.

## Checks and remaining release gates

```sh
node authoring/fpv-worlds/regions/desert-expedition/verify-library-pin.mjs /path/to/delivery-natural-r1
```

The verifier checks the exact descriptor pin, whole delivery size, source grid,
current-runtime eligibility, exact-pin appearance, all three material tiers,
safe Plain fallback, and all six prior main pin identities. On an older runtime
it confirms the actual production downloader
rejects after the descriptor and two manifests, before any terrain asset; the
UI does not offer that row. Once 512 m is supported, the same check performs the
full 2,051-response production download against the exact immutable payload.

Both paths passed during preparation. The positive path was a **composed source
check**, loading only the exact `region-manifest.mjs` from capability commit
`cf9d2b3a9170ad6e240b1d29a486b7ef4afcd965` into this main-based verifier. Its Git
blob was checked as `ba7fc056d507cb4c8ea631a24914e97649a6be0d` before execution.
That read-only composition verified all 2,051 responses and eligibility; it is
not an exact package, native player launch or runtime integration receipt.
The same full 2,051-response check subsequently passed without any loader or
module substitution on coherent main `39b2eeee74f0ca3332fa2f8b047aba55e64c1382`.
See `library-verification.json` for the historical and coherent-source results.

Keep this PR Draft until a fresh coherent package containing the capability,
this row and the accepted material foundation passes qualification.
Qualify archive/import/budget checks, normal Library download/install/Fly,
saved-row reload, explicit arming/pause, six starts and the origin-unavailable
journey. Neither a hidden-row old-runtime package nor an authoring preview is
evidence of normal player admission. Device FPS and finished-art acceptance
remain separate gates.
