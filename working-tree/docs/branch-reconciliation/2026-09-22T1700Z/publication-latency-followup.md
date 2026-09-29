# Measured publication latency after temporary test waiver

PR274 merge20:56:49Z → production35783546172 success21:05:58Z:549seconds. Automated suites skipped explicitly.

- Assembly191seconds: checkout22, source/archive validation42, assembly52, independent byte reread44, artifact upload19; remaining setup/receipts12.
- Deploy312seconds: second full checkout281, runtime5, latest-stable recheck2, actual Pages22, setup/cleanup2.
- Remaining46seconds: scheduling and handoffs between merge/jobs.

Smallest proposed CI-only improvement: exact-SHA shallow non-cone sparse deploy checkout of `publishing/pages-controller/release-policy.mjs`, `publishing/pages-controller/metadata.mjs`, `publishing/pages-controller/publication.json`, and `scripts/pages-archive.mjs`. These total294697bytes versus1596845278trackedbytes. Retain latest-stable recheck, Node pin, SHA binding, environment and production serialization. Coordinate PR235 ownership before modifying workflows; no change implemented by this read-only audit.

Do not promise281seconds saved on every run: earlier full deploy checkouts took25–36seconds, and underlying transport/runner delay for this run was not established from live logs.

Separate larger improvement: bounded concurrency for archive API checks;52archives ×3requests ×3validation phases currently468serialrequests. Retain every independent recheck and final artifact-byte verification; optimize scheduling rather than removing coverage.

These proposals do not weaken builds, immutable source/assets, historical archive preservation or availability verification. Tests remain optional per PR272, and skipped is never a pass.
