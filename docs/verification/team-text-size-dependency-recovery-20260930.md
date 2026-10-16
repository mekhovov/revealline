# Restored Team text-size dependency

This source-only correction recovers a declaration and its paired assertions from
closed PR #757 (541d7fcde298ccddffe3f683698bf890212db766) onto main 8d777fca0c55547264bcd53f31d02cd35c08e71b.

The current Team recipe declares coop-actor-layout.mjs, which imports
resolveTextSize from game/text-size.mjs. The imported leaf controls Standard/Large
canvas cue sizing. Omitting its bytes would let this consumer change without
invalidating the Team fingerprint. Restore that input adjacent to the layout.
The existing shared-input mutation test now expects Team to be the consumer, and
the missing-byte test requires this input to fail closed. All newer guard tests
remain intact. No tests were executed for this source-only correction.

## Provenance boundary

The ordered Team input fingerprint changes from 1d906a6cf6bc5e7ae7fab7fb9f8c5ef194675566b4748f1800a0a0f289181808
to d117d023b097472e8975a7fa6e0384ba72bcc194ee84405e7afbe3753df14605. The equipment closure includes the Team inputs, so its fingerprint
also changes from a2e7687e2027be34a75dc17f95b15653819c473f9135307de7cca1c5780c37cc
to 2f7fb6ecbbf1a4b0f8b165de3b737f603ab57f1350ac1940867a8c9c62e933d2. These are independently computed byte hashes, not new
review approvals. No reviewed constant, original evidence, production ledger,
compiled asset, collection binding, runtime module or historical revision is
changed. Existing generated production is not claimed to match current source.
A future generation must retain every predecessor and obtain a reviewed forward
continuation; do not copy these hashes into approval constants or run --write just
to clear a mismatch. Full suites remain WAIVED_SKIPPED_NOT_PASSED.

## Deployment impact

The correction changes only two scripts and this document, outside the current
explicit Pages build includes. The current main Pages build packages accepted
compiled assets; it does not invoke the field-kit producer. Required protected
merge and hosted Pages budget gates remain unchanged. There is no new playable
content or enlarged offline cache in this change. The separate missing Resume
regression scenarios and broader inventory recovery remain open.
