# Exact release-object recovery

This change hardens the existing publisher. It does not establish the root cause
of the historical `exact draft release was not created` failures and does not
authorize a new publication, tag, or asset replacement.

## Behavior

- A successful draft creation must return a positive release ID and matching
  version, exact commit, stable-channel and draft identities. Confirmation reads
  use that ID, not the release-by-tag endpoint or a draft-list scan.
- Confirmation performs at most four reads, with delays of 0, 1, 2 and 4 seconds.
  Matching objects resume; mismatched identities stop immediately.
- A transport failure, unreadable successful response, server error, or explicit
  `422` / `already_exists` conflict permits bounded read-only discovery. It never
  causes the HTTP helper to repeat the mutation. Other 422 errors stop with a
  sanitized message and structured error codes instead of being suppressed.
- Exception scoped to creating a Git reference: 409/422 can omit structured
  conflict codes, so they permit bounded read-only authority discovery. The
  exact annotated tag and source must match; absent/mismatched refs still fail,
  retaining the original error when discovery is exhausted. This does not
  change release-creation 422 handling.
- GET requests have a three-attempt budget. Rate-limit reads respect
  `Retry-After` or the primary-limit reset. A required wait exceeding 60 seconds
  stops with a retry-delay diagnostic; it is not shortened to retry early.
- Mutations remain serial. Authentication/authorization failures do not become
  retry loops. Error diagnostics redact the configured token and bearer values.
- Existing tag/source checks and the exact nine legacy asset contract remain.
  Duplicate asset names now fail before a map can hide the duplicate. Published
  assets are never replaced.

## Validation

Run the bounded publisher/authority/input cohort:

```sh
node --test publishing/fastline-release-publisher.test.mjs publishing/fastline-release-objects.test.mjs publishing/fastline-release-inputs.test.mjs
```

The cohort covers delayed discovery, successful creation receipts, genuine
validation failures, existing-object conflicts, ambiguous outcomes, absent or
mismatched objects, rate limits, credential redaction and asset reuse. These are
mocked API tests, not a production recovery or end-to-end publication canary.

## Integration and outstanding work

Merge only in the sole coordinator's explicit integration window after active
v0.141.4 public acceptance. Do not modify its frozen source or retry its completed
publication. Independently review this head and run hosted checks before merging.

The existing final command output retains the confirmed release ID. This patch
does not yet persist every intermediate response across process termination.
Cross-run dispatch deduplication, durable all-stage receipts, current-run evidence
assembly, archive/selector/player handoffs, and interruption testing for the full
chain remain separate work. Keep the existing resume route until its replacement
passes recovery tests. Do not infer production latency savings from unit tests.

The subsequent approved canaries are admission (#658, workflow-only), retention
(#659, selector-only), and manifest migration (#662, one new game release after
legacy compatibility and completed-release shadow comparison). No extra game
release is needed for the first two. Version reservations must be confirmed with
the coordinator before changing queue metadata.
