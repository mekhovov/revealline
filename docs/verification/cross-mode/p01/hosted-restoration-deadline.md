# P01 hosted restoration fixture deadline

The fresh-import subtest now gives its existing initial picture-readiness wait 30 seconds. This applies only to `fresh app import restores the saved flight` in `game/test/external-chapter-app.test.mjs`, using the helper’s existing option and the same allowance as this file’s picture `settle()` calls. The shared five-second default and all runtime deadlines remain unchanged.

[Hosted shard 3](https://github.com/mekhovov/revealline/actions/runs/34951434495/job/104323400416) on source `6cfe315e5c266075c63f9d651ce12c21c57152c1` failed before the Continue handler: its initial picture predicate was still pending at the five-second fixture deadline, with no reported errors. This installed-original reload performs actual metadata, Blob, hash and picture-binding verification. Test teardown then cancelled the page’s pending work, so eventual completion of that CI attempt is unknown.

The unchanged restoration parent passed in the local exact-source full run and in a separate focused run. The full run completed **4,185/4,185**, with no failures or skips, before this change. This supports a fixture timing problem under hosted load; it does not convert the failed hosted run into a pass.

Every existing assertion remains: exact saved pin and authoritative checkpoint, paused restoration, no progress before explicit Resume, resumed progress, and no host errors. The corrected focused parent also passes. Its three TAP passes comprise the parent and two nested tests; 13 unrelated tests are excluded by the name filter. No test is disabled or readiness condition bypassed.

[The receipt](hosted-restoration-deadline.json) records original and corrected test identities, complete cache-log paths and SHA256 hashes, observed results, and the exact command. Large raw logs remain in cache. Fresh exact-source qualification is required for the changed source; this note is not release acceptance.
