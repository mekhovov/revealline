# v0.61.22 — current-theme frame assertion correction

The completed [manual qualification](https://github.com/mekhovov/revealline/actions/runs/35360630295) and [PR source run](https://github.com/mekhovov/revealline/actions/runs/35360556887) tested exact source `80efcc3ddda302a014c3409c248892f36b3a12a9`. Each recorded **5,922 tests: 5,921 passed and one failed**, with no skipped tests. Both preflights and the PR ordinary build passed; manual freeze was skipped. The [original evidence ZIP](originals.zip) and [member index](originals-index.json) retain all terminal job logs/metadata, the finite observations, dispatch records including the initial workflow-lookup 404, and local correction checks.

Both failures are the same assertion in `game/test/coop-actor-presentation.test.mjs`: the selected compiled FPV theme is revision 30, while the test still expected revision 28. The one-line correction updates only that current-theme expectation. All five frame IDs, asset revision 2, PNG hashes, byte counts, dimensions and geometry remain pinned, as do the gameplay-state and contact assertions. Runtime, artwork, compiled presentation and version are unchanged.

The complete **21-case test file passes once on Node 20.19.5 and once on Node 22.22.2**, with zero failures or skips. These are focused correction checks, not a full source qualification, a rerun of the former 100-case cohort or new native/public acceptance. Lint and formatting checks also pass.

The observer completed after eleven spaced snapshots. Its preserved failed-run retention successor allows exact already-failed job originals to finish collecting while this test-only source correction is prepared; successful qualification still requires its original exact-source guards. No workflow was retried by that observer and no artifact body was downloaded.

Next, review and commit the exact delta, then qualify the new source. The earlier [production correction](../production-correction/README.md), [actor implementation/native evidence](../README.md) and their limited review scopes remain immutable. No parent phase is closed here.
