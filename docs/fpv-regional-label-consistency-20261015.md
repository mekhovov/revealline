# Regional Library label consistency — 15 October 2026

Nine offered regional editions changed names after installation because the Library card and flight preparation screen switched to the immutable descriptor's title. The catalogue's shorter player-facing names now remain consistent before download, after installation, after refresh and in flight preparation, in English and Ukrainian.

The presentation alias resolves only for the approved region ID and exact descriptor SHA-256. Different editions of the same region remain separate. An unoffered retained revision keeps its own descriptor title. No descriptor, immutable URL, hash, revision, manifest, asset, physics or saved content changes.

Five advertised totals previously omitted the small descriptor itself. They now include it, consistently with the other offers:

| Edition                      | Previous bytes | Corrected bytes |
| ---------------------------- | -------------: | --------------: |
| Tropical connected harbour   |      7,952,305 |       7,958,922 |
| Hillside courtyard-r5        |      8,660,487 |       8,667,066 |
| Hillside town-r2             |      8,352,486 |       8,359,044 |
| Tropical districts review-r2 |      7,857,157 |       7,863,766 |
| Tropical bounded review-r1   |      5,982,641 |       5,989,243 |

## Verification

The focused six-test regression suite passes. On the unchanged source baseline, four tests failed and two passed. Coverage checks all 23 existing pin identities and verified descriptor-byte totals, EN/UK flight labels, separate same-ID editions, clearing a stale alias for an unknown hash, actual Library install/Fly/refresh handlers with isolated memory records, retained unoffered versions and invalid descriptor/title rejection. The existing five-group Library edition verifier also passes. Syntax, lint and formatting checks pass.

The fixture contains metadata from the existing 23 immutable descriptors, retrieved through their pinned public URLs and checked for exact byte length and SHA-256 during the read-only map inventory at main revision `206ccd8b53180c061d394069037678de1b33761b`. The implementation baseline is `1a8da96e75f0a8cc776fc84d9da880d6bf1357ee`, whose regional catalogue and session modules are unchanged from that inventory. The fixture contains no scene assets, commands, proof progress or playback data. Tests neither open a renderer nor use player storage.

These are source and isolated presentation checks. Exact-head package checks, native/public before-and-after installation, reload and language-change acceptance remain separate release gates. This receipt does not establish public deployment, physical-device performance, offline/restart continuity, final art quality or elapsed endurance.
