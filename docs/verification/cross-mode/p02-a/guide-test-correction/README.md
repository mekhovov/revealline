# Full-regression guide fixture correction

Hosted run [34991160287](https://github.com/mekhovov/revealline/actions/runs/34991160287) tested source `6de5ea1160c519b39f0a98a1c9f054262191ea17`. Shard 2 failed two of 1,032 cases because old Guide music tests required Play to persist an implicit master unmute. P02-A intentionally separates transport from master intent, so that condition could not become true. This was a stale test contract, not an environment failure; the failed result remains retained.

The single test hunk now proves that Play starts a muted stream while legacy `musicEnabled` stays false, then explicitly operates the real master control. Its original audible/paused-music Guide scenarios and every later stream, position, return and paused-flight assertion remain. No production source, timeout, version, producer or storage limit changed.

The whole corrected file passes 6/6 on Node 22.22.2 and 20.19.5, with no skipped or cancelled tests. File lint, format and diff checks pass. These scoped results do not replace a fresh full qualification of the corrected final source. The previous run's other results and still-running shard must be retained separately; this receipt does not declare the whole run passed.

Raw job metadata, both before/after exact tracked-source identities, full failed log, diagnosis, corrected input pins and two local whole-file results are included. JSON copies use repository formatting and log copies only trim trailing whitespace; `index.json` retains original sizes and SHA-256 values.
