# Soundtrack directory bulk reconciliation — untested input

Original PR #604 head: f901f73377bc5a8466933f260e2c0828bcd3226c. Current private intake, live localized catalogue errors and status ownership, and opening fallback are retained. Trusted numbered-archive directory and shard source plus its focused assertions are incorporated; no new functional pass is claimed. Existing catalogue checks continue to use semantic error metadata through the generalized bounded fetcher. New directory-only checks retain authored fallback details pending complete cumulative localization.

The donor’s unrelated Studio controller timing and Prepare-Promise interception edits are not replayed; their original bytes remain reachable through the merge parent. Only directory import and metadata-request assertions are taken in that host file. The newer canonical timing behavior and assertions remain unchanged.

## Required cumulative fixes before qualification

- Validate each optional shard transactionally before committing any tracks, identities or counts; late conflicts must leak no rows. Quarantine a later conflicting optional shard deterministically, and keep required failures fatal.
- Preserve directory-fallback and optional-shard diagnostics as Error/localization objects; render live localized degraded status while valid rows remain playable.
- Bound transport queues to 256 while keeping every visible row individually playable (selected window or rotation from clicked row); preserve order, shuffle, repeat and mix preferences.
- Add paired EN/UK directory, partial-failure and queue-bound messages and the corresponding source/panel/host regressions. The reported peachtea.last-stand-lets-go identity collision requires explicit handling; no public archive activation or collision clearance is claimed here.
- Run the union of existing private-intake, catalogue, panel, host, localization and opening-fallback checks on the final aggregate. Full suites remain skipped, not passed.
