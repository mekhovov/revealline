# Release automation maintenance observation — 18 September 2026

Successful Pages run35361114741 warns that checkout/setup-node/upload-artifact/deploy-pages action runtimes declare Node20 and are being forced to Node24. This is distinct from the intentionally selected Node versions used to test the game source.

[GitHub’s current deprecation notice](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/) was checked on18September2026. Its25August2026 update schedules removal of the old Actions runtime for23September2026 and recommends action versions using Node24. The current publication succeeded; the warning is not evidence of a failure.

Add a bounded P18/release-maintenance follow-up: review compatible immutable action revisions, qualify the existing publication and artifact workflows on the new declared runtime, retain original workflow/source identities and rollback. Review the source-test support matrix separately rather than silently replacing Node20/22 evidence. The observed upcoming ubuntu-latest migration also warrants an explicit runner-image compatibility check before final release qualification. No workflow changes are made in this delivery.
