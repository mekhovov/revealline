# Bounded compact-envelope capacity

Base: `d55b10d523e15d991cbedc6e283fab396120ee47` (main, version 0.107.0). This prerequisite changes only compact-envelope node accounting. It does not adopt PR #333, alter its runtime or regenerate production data.

The quick-controls dependency repair on PR #333 correctly adds 39 immutable source-stage successors. Its complete review-and-administrator-replacement fixture then contains 99,761 logical nodes and 543 dictionary strings. The wire representation has 100,307 nodes: the document plus its dictionary and three wrapper nodes. It is below the logical 100,000-node cap, 8 MiB logical cap, 5 MiB encoded cap and 4,096-record limit, but the former shared node cap rejects the envelope. The exact original-head capacity control passes; the new repaired-ledger fixture fails. Both results and a diagnostic loader that changes no guard are retained here.

The compact reader/writer now derives its wire cap as `100000 + 4096 + 3 = 104099`. Dictionary indexing replaces each provenance string with one numeric node; only the bounded dictionary entries, enclosing object, format string and dictionary array are additional. Logical ownership remains capped at 100,000 nodes. Legacy raw input retains its existing bounds, and decoding still validates the reconstructed logical document. Bytes, depth, strings, array cardinality, records, semantic checks and immutable history are unchanged.

Shortening provenance cannot fix this node-count failure: a long string and its numeric index each count as one node. Rewriting or deleting historical records would also violate the preservation contract. The separate cap accounts for the existing format overhead without admitting additional logical history. The triggering replacement has only 239 logical nodes of remaining capacity, so further production changes must be measured again.

## Verification

- New transport-boundary fixtures round-trip exactly 100,000 logical nodes, 4,096 used dictionary entries and 104,099 envelope nodes. They reject the next logical node, next envelope node, 4,097 dictionary entries, over-budget expanded data under a smaller dictionary, and raw legacy data attempting to borrow the envelope allowance.
- The initial two new regressions fail against the unchanged codec; original output is in `codec-red.tap`.
- Complete codec, data-JSON and model-metadata files: 26 passed, no skips.
- Complete main production-history file: 12 passed, no skips.
- The previously failing PR #333 capacity case passes with only this codec overlaid through a read-only ESM loader: one selected test passed, 11 intentionally skipped. This is an integration probe, not a combined branch or release qualification.
- Complete transfer/system results and source-file hashes are recorded in `evidence.json`. The initial sparse-checkout failures are preserved; missing repository fixtures were restored from the exact base before rerunning.
- A broader metadata/IO run found one existing failure at `presentation-metadata-io.test.mjs:202`: the fixture expects 5,242,880 canonical bytes but receives 3,386,243 after compaction. It reproduces with the exact original codec (one failure, three intentional skips). That fixture was not changed here. Its original failure and wider results are retained, and this PR does not claim the full repository test suite passes.

No generated ledger, compiled asset, media, version or workflow changes belong to this prerequisite. Review and hosted checks remain required. These tests do not establish visual, audio, physical-device, offline, frozen-build or public-release acceptance.
