# Bounded archive authority observations

This local infrastructure candidate changes only the remote archive-observation
transport used by `publish.mjs`. It does not select a new game, change public
bytes, publish anything, or establish a hosted speed improvement.

Each `verify`, `build`, and `verify-artifact` invocation still performs its own
fresh authority pass. There is no cache or reused observation. Four workers each
read one archive's exact main commit, admitted deployment, and latest deployment
status in that order, with at most one live API child per worker. Results retain
the admission order regardless of network completion order. Repository names,
endpoints, identity/environment/status assertions and receipt fields are unchanged.

Transport limits are 60 seconds per API process, 16,000,000 bytes per stdout and
stderr stream, and 180 seconds for the complete archive-observation phase. The
phase deadline is a new explicit fail-closed ceiling, not a performance promise;
hosted preview must confirm it accommodates the admitted archive inventory.
Timeout, transport error, invalid JSON, overflow or authority failure stops new
work and aborts in-flight requests. Children receive SIGTERM, then SIGKILL after
one second if needed. The phase waits for every active child to close before
returning or throwing; no partial observation is accepted. API failures are not
automatically retried or treated as evidence of successful deployment.

Timing is emitted only on stderr as an `archive-authority` phase diagnostic,
including archive count, worker limit and elapsed milliseconds. A timing line
alone is not a pass; ordinary command exit and authority evidence still govern.
JSON stdout and artifact receipt schemas are unchanged. Qualification hash/tag
checks, latest-stable policy, all three fresh passes, final independent artifact
inventory reread, archive retention and the deployment sparse checkout remain.

Run the dependency-free focused cohort with:

```sh
node --test publishing/pages-controller/archive-authority.test.mjs
```

The fake transports exercise ordering/cap, fresh calls, fail-closed missing or
changed authority, peer cancellation/settlement, phase and request deadlines,
output bounds, invalid JSON, command identity, spawn failure and kill escalation.
These local tests do not contact GitHub or measure hosted/network savings.
Independent exact-head review and a deduplicated hosted preview with the actual
admissions are required before merging. Compare the three phase timings and
unchanged successful observation inventories with the retained serial baseline;
do not remove later checks to manufacture a faster result.
