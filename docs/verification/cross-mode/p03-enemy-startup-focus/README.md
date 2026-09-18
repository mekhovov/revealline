# Enemy Workshop startup close focus — v0.61.20 source evidence

This cohort records the scoped correction based on source `6db978db40287151489803e915cb4ecb9ea232ee`, tree `50391b01ad011079c9ba66fe7e4f9f0ed229a1f9`. The original native observation was made on v0.61.3 source `58ff1b1da3c5487412e168ce34539866ac2f4970`: closing the startup catalog left BODY focused, and forward Tab/Right did not restore visible focus. It is a prior finding, not candidate native acceptance.

The untouched startup opening now provides the enabled Open workshop control as its return target. Restoration requires an actual foreground, focus-owned close; explicit invokers, newer deliberate focus, reopened visits, hidden/blurred pages, repeated close and child practice ownership are preserved. There is no global focus-stealing handler.

| Retained run | Result and scope |
|---|---|
| Baseline startup regression | Base production with new regression tests: 3 pass, 3 expected focus failures, 16 filtered tests. |
| Node 20 / Node 22, r1 | Each: 36 pass, 2 fail because dynamic JSON fixtures were not yet hydrated in the sparse checkout. The five bounded additions are recorded. |
| Node 20 / Node 22, r2 | Each: 39 pass, 2 fail because the new test incorrectly expected native page ArrowRight to traverse links. Production page keyboard routing was preserved; the test was corrected to use forward Tab. |
| Node 20 / Node 22, r3 | Each: all 39 focused host, panel and practice tests pass; no failures or skips. |
| Final targeted lint / formatting | Both exit 0. Exact commands and original output are retained. |

Every file in `originals/` is a byte-exact copy, including empty stderr files and original local paths. `manifest.json` pins the retained bytes and provenance; `source-input-pins.json` pins all ten changed source inputs and the unchanged practice test. The exact base Git tree identifies unchanged source dependencies. Intermediate test-file snapshots were not separately retained, so these records do not claim exact reconstruction of earlier harness revisions. Large source or maintainer-skill snapshots are not duplicated here.

The execution register has a separate current-status update. Its original root header and first integration receipt remain unchanged in `originals/`; `current-register-cutoff-update.json` records the later root-reported v0.61.3 release/archive and v0.61.9 inspection advances. The 120,755-byte historical body remains byte-identical. Public acceptance is still scoped to v0.61.2 at this cutoff; later release/inspection progress does not extend it.

This is source evidence only. The finite test DOM models focus ownership and page Tab order; it does not prove native layout, painted focus or physical-controller behavior. No candidate native browser run, full suite, ordinary build, commit, remote mutation, release or public acceptance is claimed by this cohort. Root will test the exact committed candidate natively before full CI.

The remaining native check is to close untouched startup from Presentation with Escape and Back, observe painted focus on Open workshop, then forward Tab through the playground and Return. Also check explicit reopening, a newer Return choice during loading, repeated controller Back and child practice ownership, with no implicit draft writes or navigation.
