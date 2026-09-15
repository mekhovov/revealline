# Production revision capacity correction

The first v0.57.2 candidate, `69195ddd1d21a7bc3f863cf7589069a735301a03`, failed the production-history capacity test locally and in GitHub PR job `104427874133`. Its complete local suite ended naturally with 4,218 tests: 4,217 passed, one failed, and none cancelled, skipped or marked todo. Source bytes remained unchanged. This candidate is not qualified or publishable.

The capacity fixture preserves all r22 records, adds 194 reviewed successors, then replaces all 194 required assets. Static reconstruction measured 3,918,640 serialized document bytes and a 3,930,198-byte transfer manifest. Both fit the existing 4,194,304-byte limit. The old traversal charged 4,218,628 bytes because it counted array indexes as object keys and reserved 24 bytes for each number.

The correction counts actual JSON UTF-8 bytes: escaped strings and object keys, finite numbers, null/booleans, container delimiters, commas and colons. It serializes only validated primitives during traversal. The final encoded-size check and existing shape, accessor, cycle, node, depth, string and array protections remain. Manifest, bundle, asset and history limits remain unchanged; no historical revision or original artwork is removed.

The isolated proposal reproduces four boundary failures in the original and passes ten checks after correction. Actual source tests cover exact-size and one-byte-over arrays, numbers, Unicode, escaped text, lone surrogates, the default 4 MiB limit and hostile input without invoking getters or toJSON. The unchanged production-history test must also complete review, replacement, export, import and adoption with all originals preserved.

All 224 focused source checks pass, including the unchanged production-history round trips and the relevant presentation, Library, bindings, replay, session, media, backup and attempt-export boundaries. The 132 tested source/input pins match before and after. Independent static review found no blocker; this is not a measured performance claim. The [retained evidence](production-capacity/README.md) keeps the original failure, measurements, isolated reproduction and actual source retest distinct.

Complete qualification of the corrected commit and public v0.57.2 verification remain separate requirements. The version remains the next unused v0.57.2; the failed candidate was never tagged or published. P01 remains unaccepted and P02 is queued.
