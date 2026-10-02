# Lossless soundtrack metadata compaction

Current main `2f009d3357fc966b879c81a316909b9fa3e4d31e` exceeds the existing
64 MiB offline edition limit for `droneaid-nl-community`: 820 files and
67,127,362 bytes, an excess of 18,498 bytes. Its engine closure contains no
optional-practice files; the Garage recordings and Hangar textures do not cause
this failure.

The maintained soundtrack metadata generator now emits compact JSON literals.
Declaration-level formatting directives preserve that representation during
normal regeneration. The generated module shrinks from 148,255 to 114,695 bytes,
saving 33,560 bytes. All four exported values, property/array order, strings,
recording references and approval metadata remain exactly equal.

Both independent regenerations produce the same candidate bytes. Existing
configured publication metadata and media-pin validation succeeds, and syntax,
ESLint and Prettier checks pass. All 18 production editions compile sequentially
in memory with their ordinary code/media validation and existing 2,000-file /
64 MiB guards. The largest edition is now 67,093,802 bytes across the same 820
files, leaving 15,062 bytes of capacity.

The two existing soundtrack distribution/archive suites report 12 passes and
17 failures on both unchanged main and this candidate, with identical failure
names. Twelve archive cases omit the i18n fixture dependency, four expect an old
error-message substring, and one archived CLI fixture omits
`offline-core-closure.mjs`. These baseline failures remain visible in the
[evidence receipt](evidence/compact-soundtrack-metadata-20261002.json) and
[baseline comparison](evidence/compact-soundtrack-baseline-parity-20261002.json); they are
not reported as successful tests. The baseline comparison saved recovery copies,
restored only the two implementation files temporarily, then verified the exact
candidate hashes after restoration.

This evidence describes working-tree generation and in-memory compilation.
Frozen archive admission, protected merge and deployment remain separate gates.
No additional unit coverage or listening/physical-device acceptance is claimed.

## Reproduce the functional check

From the repository root, run the maintained procedure below. It regenerates
metadata twice in memory, compares ordered exports against the exact baseline,
validates the actual configured publication metadata, then compiles all 18
production editions sequentially without writing distribution archives. The
optional output path must be new.

```sh
node docs/evidence/verify-compact-soundtrack-metadata.mjs \
  --baseline 2f009d3357fc966b879c81a316909b9fa3e4d31e \
  --out /tmp/compact-soundtrack-verification-new.json

node --test scripts/test-soundtrack-distribution.mjs \
  scripts/test-build-soundtrack-archive.mjs
```

The second command retains the separately disclosed baseline failures. The
functional procedure adds no unit tests and does not claim those suites passed.
