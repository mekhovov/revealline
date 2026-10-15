# Batched replacement storage review — 15 October 2026

Candidate queues old active-asset deletes using keys captured by the same
transaction's existing project-index read. It removes an extra cursor traversal;
retained revisions and active metadata still commit atomically together.

Native isolated phase diagnostic (Codex browser, macOS host): two synthetic
2,063-file revisions, each 47,449,000 bytes. Frozen baseline e006821b: first
transaction 824 ms; replacement 1,233 ms; cursor phase 229 ms. Batched candidate:
first transaction 833 ms; replacement 1,041 ms; delete queue 16 ms. Both retained
revisions were readable and all hashes verified. These single observations include
instrumentation; they do not establish general device performance.

Existing world-content checks pass 12/12, including stale-generation rejection and
rollback after queued writes. Existing regional-removal scenarios pass 4/4.

The full frozen Desert player at origin 9118 separately timed out while launching
natural-r1 after installing landmarks-r1 and natural-r1. Both downloads survived.
Isolated baseline serial verification took 343–378 ms, so storage/hash cost alone
does not reproduce the full-player stall. This candidate is not its verified fix.
Exact package qualification and production phase investigation remain open.

Raw diagnostic receipts are preserved externally as
`fpv-temp/storage-baseline-native-20261015.jsonl` and
`fpv-temp/storage-batched-native-20261015.jsonl`. Diagnostic UUID databases were
removed through their dedicated fixture; no player database was modified.
