# Preserve bounded immutable theme history

Implement or extend Reveal Line presentation metadata using the exact current source and an authenticated production document. Read [the bounded history contract](../../docs/presentation-metadata.md). Keep every retained record and original payload unchanged. Never shorten provenance or discard history merely to make a fixture fit.

Separate the 5 MiB serialized metadata budget from the explicit 8 MiB/100,000-node logical-history budget. Preserve old raw readers and byte-identical fitting V1/V2 transfers. Compact only the declared provenance strings; reject malformed dictionaries and count every expanded occurrence. Before accepting an edit, prove that it can be saved and exported within all bounds.

Exercise the real collection review and replacement journey, including atomic failure, stale generation, undo and recovery. Follow encoded bytes through compiler formatting, published loading, Studio storage and bundle export/import. Check exact boundary overhead rather than increasing a limit for a wrapper or newline. Preserve production reproduction and replace any generated-format exception with a deterministic format/budget check.

Record source/input hashes, original failures, complete affected test files, current-output byte comparison and the first limiting budget. Do not claim native, offline, physical-device or public acceptance from codec tests. Assign the release version only after integration and run every source, artifact and deployment gate.

For validation reuse, trust only exact identities of model-owned logical documents after complete validation and deep freezing, held in a module-private WeakSet. Caller-frozen objects, mutable inputs, clones and proxies still require fresh ownership and validation; previous-history, expected-revision and selection-option checks remain active. Prove stale or rewritten history and later caller mutations cannot reuse acceptance, and measure the real retained-history refresh path without introducing timing thresholds into correctness tests.
