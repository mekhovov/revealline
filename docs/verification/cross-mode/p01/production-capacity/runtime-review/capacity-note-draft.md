# Production revision capacity correction

The first v0.57.2 candidate, `69195ddd1d21a7bc3f863cf7589069a735301a03`, failed the production-history capacity test locally and in GitHub PR job `104427874133`. It must not be published or described as qualified. The local run was intentionally stopped after the reproduced failure; its remaining cases are not claimed complete.

The capacity fixture retains all r22 records, adds 194 reviewed successors, then replaces all 194 required assets. Static reconstruction measured 3,918,640 serialized document bytes and a 3,930,198-byte transfer manifest. Both fit the existing 4,194,304-byte limit. The traversal instead charged 4,218,628 bytes because it counted array indexes as object keys and reserved 24 bytes for each number.

The reviewed correction counts actual JSON UTF-8 bytes: escaped strings and object keys, finite numbers, null/booleans, container delimiters, commas and colons. It serializes only validated primitives during traversal. The final encoded-size check and all existing shape, accessor, cycle, node, depth, string and array protections remain. Manifest, bundle, asset and history limits remain unchanged; no historical revision or original artwork is removed.

The isolated proposal reproduces four boundary failures in the original and passes ten checks after correction. Actual source application, production-history round trips, relevant boundary regressions and complete new-commit qualification are still pending. No public or phase acceptance follows from this proposal.
