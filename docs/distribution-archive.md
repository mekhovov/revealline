# Complete distribution archive contract

Complete browser builds can explicitly select lossless adaptive compression with
this exact `game/build-config.json` field:

```json
"distributionArchive": {
  "format": "revealline-distribution-zip.v2",
  "maxExpandedBytes": 1073741824
}
```

The same marker appears in the emitted manifest, `game/build-info.json`, and frozen
`release.json`. The frozen inspector reads the configuration from the exact source
commit and requires the release, manifest, and build identity to agree. The local
browser fixture also checks its included configuration and manifest; it does not
replace the publisher's external SHA/Git binding. Unknown fields, unknown formats,
missing or conflicting markers, noninteger limits, and limits above the existing
1 GiB default are refused. Smaller positive source limits are allowed.

## Representation and accounting

Every original member and license remains present, with unchanged per-file byte
counts and SHA-256 hashes. Members use canonical ZIP32 headers, UTF-8 names, fixed
1980 timestamps, CRC-32 over original bytes, and no extra fields or comments. The
writer sorts names and selects raw DEFLATE (method 8) only when it is smaller than
STORE (method 0); ties use STORE. Compression parameters are level 9, window 15,
memory level 8, and strategy 0. Reproducibility requires the same Node/zlib runtime;
no cross-version compressed-byte guarantee is made.

`maxExpandedBytes` counts every original payload byte **plus the exact manifest
bytes**. The builder enforces it before replacing an existing output. The trusted
inspector independently enforces the same bound and refuses a source ceiling above
1,073,741,824 bytes. This uses the existing default envelope, without raising a
trusted capacity ceiling.

Unmarked historical builds remain STORE-only. `createZip(entries)` still defaults
to STORE, so optional practice packages and their existing contract are unchanged.
The legacy Pages metadata reader accepts a strictly matching optional marker for
otherwise admissible releases; it retains its separate 800,000,000-byte limit.

## Reader guarantees

The Python frozen inspector checks the exact end record and a 32 MiB central
directory bound before constructing Python's eager ZIP reader. It admits at most
20,001 members (20,000 payload rows plus the manifest), checks local and central
headers independently, and requires contiguous member data with no hidden gaps.
Raw inflate output is streamed in at most 1 MiB chunks and checked against each
member's declared original length, CRC, and SHA-256. Unknown methods, ZIP64,
overlapping or disagreeing headers, duplicate or unsafe paths, missing or extra
members, truncated streams, trailing compressed data, and extra expanded output
are rejected.

The local browser archive fixture has the same fixed-header checks and 1 GiB
expanded ceiling. It reads requested members on demand, bounds each requested
resource at 64 MiB, verifies CRC and manifest SHA, and checks the compressed stream
consumed exactly its declared bytes. It does not materialize an expanded site.

## Limits that compression does not change

| Boundary                                             |              Existing limit | Effect of this format                                                                            |
| ---------------------------------------------------- | --------------------------: | ------------------------------------------------------------------------------------------------ |
| Complete hosted ZIP                                  |           950,000,000 bytes | Smaller container may fit; exact final source must still be measured.                            |
| Source-admitted expanded archive, including manifest |         1,073,741,824 bytes | Enforced by writer and inspector; no increase.                                                   |
| Native extracted payload                             | 805,306,368 bytes (768 MiB) | Original payload size is unchanged, so the measured complete payload still fails.                |
| Legacy Pages metadata/extraction                     |           800,000,000 bytes | Complete payload still fails its original manifest-byte admission even with a compatible marker. |

The prior exact-source `90616ad44` measurement projected 908,988,197 container bytes
and 1,072,534,542 expanded bytes including its then-current manifest. That was a
per-member compression/roundtrip measurement, not a completed production archive
or a measurement of later commits. Its roughly 1.2 MB expanded headroom is small.
See [the source-pinned measurement](team-duel-release-compression-2026-10-15.md).
Rebasing, new metadata, or content changes require fresh measurement.

The format does not close the required-evidence assembler gap or change general
source-manifest admission. It does not dispatch publication, raise the source TAR
upload cap, waive release tests, or approve an immutable release. Current release
blockers are tracked in [release readiness](team-duel-release-readiness-2026-10-15.md).

## Focused verification

- `scripts/test-distribution-archive.mjs`: actual small builds, deterministic mixed
  archives, exact original bytes, malformed headers/streams, marker and byte-budget
  refusal, and default STORE compatibility.
- `scripts/test-game-cli.mjs`: actual Git-frozen snapshots for both unmarked and
  admitted sources, including release/manifest/build marker agreement.
- `publishing/distribution-archive.test.mjs`: runs the independent Python suite and
  existing release-artifact suite. Fixtures exercise the actual Node writer inside
  original artifact ZIPs, original Git TAR and Git-manifest source representations,
  the frozen offline consumer, bounded directory admission, and adversarial ZIPs.
- `scripts/test-optional-distribution.mjs` and `scripts/test-optional-practice.mjs`:
  existing optional contracts and reproducible package bytes remain supported.
- `scripts/test-external-distribution.mjs`: full real-source compatibility checks
  exact generated bodies after reading either admitted method. The full real-source
  build was not run during the bounded migration checks; it remains a CI/full-source
  verification obligation.
- `publishing/pages-controller/metadata.test.mjs`: legacy admission and strict
  optional marker compatibility, including the unchanged hosted capacity cap.
