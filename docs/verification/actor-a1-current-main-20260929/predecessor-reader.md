# A1 current predecessor reader

Parent actor source: `d22a6d0795ac095bbf9c988665060913a789ff07`.
This is source admission plumbing only. It adds no successor review, caller-owned
approval pin, production caller, quality stage or renderer/artwork adoption.

The existing v1 schema now recognizes exactly two immutable predecessor pins:
the historical 27 September bulk presentation record and production100's
effects20 record at
`docs/verification/bulk-queue-audio-effects-2026-09-28/review.json`, SHA256
`5ec246c93cf5dfe6d5a3f6538788d618575037a11d2c1890d88d0257f2e7d0b3`.
There is no arbitrary predecessor selector or latest-record lookup.

For the current root, effects use its existing fingerprint
`b7aa3a6b9bc2302df0309e90acddf899766a9b9406f93bd266a94b685940a5eb`.
Motion, Team and equipment retain the root's authenticated bulk presentation
ancestor. Audio ancestry is authenticated as part of the complete record graph;
audio recipes remain outside the accepted groups and matcher.

The exact current graph contains 17 unique records, so only that pinned root
receives a 17-record bound. The historical root retains its 16-record ceiling
and nine-record fixture. Repeated legitimate ancestors are read once. Introducing
an eighteenth or conflicting duplicate reference changes the immutable root's
bytes and fails its pin before the added reference is read; the tests do not
claim to authenticate a fabricated expanded graph.

Five current-main records are absent from the older actor branch. The test-only
`scripts/fixtures/actor-effects20-predecessors.json` retains their exact text:
55,224 original bytes in a 60,303-byte fixture. Every source blob was read locally
from `64c8b9d81604984363666abadae236d9f2f76f7f` and authenticated against its
existing ancestry SHA before copying. Canonical review documents remain unchanged.
When a canonical file is present, tests read it and reject changed bytes rather
than replacing it with the fixture. No network retrieval was used.

Node22.22.2 verification:

```text
node --test --test-reporter=tap scripts/test-actor-presentation-continuation.mjs
32 tests, 32 pass, 0 fail, 0 skipped, 0 cancelled
```

All 27 historical cases remain passing. Five new cases cover the complete current
graph, independent subsets, audio exclusion, fabricated roots, current effects
under the old pin, mixed-group predecessor/slot misassignment, every altered or
missing ancestor, and attempted extra/conflicting ancestry. The successor source
and payloads are synthetic test data, not approval for the 59 production slots.

Scoped ESLint, syntax, Prettier and diff whitespace checks pass. Independent
read-only review found no blocker and separately verified all five fixture
records against the same main commit. It read the passing TAP without rerunning
tests. The exact author receipt from
`/tmp/actor-effects20-predecessor-20260929.tap` is retained as
[effects20-reader.tap](effects20-reader.tap): 6,344 bytes, SHA256
`3faa87012381a2e20c765b7c2a6b3c62a150a2fdefb4656217113b8bb5f19da9`. The durable copy is byte-for-byte identical; it records
the completed focused run, not a rerun or production acceptance.

| File                                                 |  Bytes | SHA256                                                             |
| ---------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `scripts/actor-presentation-continuation.mjs`        |  9,607 | `4fdc899071f73b61d39eb217a7636314fd8cd8ae1ef0f9668d12144e3359b684` |
| `scripts/test-actor-presentation-continuation.mjs`   | 19,467 | `680ccb05a291cc7e2fe8473be872db44095abd0f02a71789c05a764aa1e63f3f` |
| `scripts/fixtures/actor-effects20-predecessors.json` | 60,303 | `8e8554a4b8c5f833c76b11a2eb99ee9e65e1d11f3b94f840633e55a040ba3c85` |

The next integration still requires review of the exact integrated source,
complete per-slot payload contracts, an explicitly reviewed successor pin and
composition with the original Team recipe/default/inherited-image and equipment
PNG/geometry guards. This reader does not refresh current source fingerprints or
approve unchanged/new artwork. Producer, compiler, PNGs, versions and publication
remain unchanged; no full build or visual/release acceptance ran. Committing this
reader and its evidence does not admit the 59 production slots.
