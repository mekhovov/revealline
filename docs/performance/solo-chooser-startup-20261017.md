# Remove unused Solo chooser construction

Ordinary Solo built a legacy Journey chooser and its backup dialog during boot,
then replaced the public chooser API with the unified Missions owner before the
shell became ready. The legacy owner could never be opened through the resulting
normal navigation. The condition that constructed it, `journeyEnabled`, already
excludes practice sessions; every affected session takes the later unified path.

A bounded modeled host run against unchanged candidate `cce49c81d82b79aefc24898f32eeebc609e569fb`
confirmed this through the ordinary public entry, title Start, Menu and Missions.
Before Start, the legacy chooser subtree contained 77 elements, including the
existing catalogue link moved into it; its backup contained 18 elements. The
campaign selector had 28 options. No mission cards were rendered. Both dialogs
remained closed throughout Direct Start. First public Missions then removed both
and constructed the unified chooser and its backup while preserving the accepted
run/checkpoint. The successful proof is retained as
`.cache/solo-followup/eager-graph-cce/legacy-chooser-proof-v2.tap`, SHA-256
`4c656c9b70974cea5ed7f4f0b7bf03a9c877c49215a590c88845bd302ceb2314`.

The change removes only this unused construction, its link move and retired-owner
bookkeeping. Title copy, progress recovery, save export, Skip and online flush
handlers remain in their existing branch. The unified constructor and opening,
launch, cancellation, backup and focus owners are unchanged. The existing catalogue
link stays on its original HTML owner with the same guarded handler, instead of
being deleted with the retired dialog. Team and Versus still use their existing
shared chooser implementation.

A new public host regression requires no chooser/backup construction before or
during Direct Start. First Missions creates exactly one pair; subsequent visits
reuse it. The check exports the actual scoped profile, inspects and restores those
same bytes through the backup UI, checks focus return and preserves the live
run/checkpoint. Four assertions in three other Solo host files now express their
original requirement—no open chooser—even when the optional dialog is absent.
The final asynchronous Browse predicate also permits the dialog to be absent while its
owner is still opening, then keeps the original strict open and result checks.
These changes retain all route, progression, replay and save assertions.

The initial regression attempted an unscoped empty backup, which the real edition
guard correctly rejected. That failed tooling attempt remains retained; the final
regression uses the actual export rather than relaxing the guard. The earlier
unchanged-source proof also retains its development errors (a syntax error and an
incorrect assumption that title Start reused the pre-start run).

The first complete eight-file check is retained in
`.cache/solo-followup/eager-graph-cce/legacy-chooser-removal-complete.tap`: 53 tests
passed and 21 failed, including parent failures after failed nested tests. Two
continuous-route failures exposed the asynchronous opening predicate corrected
above. Other failures included old saved-session envelope assumptions, progress
identity expectations, and capitalized difficulty labels; those are being
compared against unchanged source rather than treated as effects of this removal.

After correcting only the lifetime predicates, the complete candidate comparison
of `candidate-solo-host`, `journey-actor-host`, `whole-spatial-host` and
`solo-continuous-library-next-host` is terminal: 23 passed, 19 failed, exit 1,
229.204 seconds. Both complete opening/authored campaign routes now pass. The
remaining failures are two saved-session assertions, one Custom cursor assertion,
and 16 spatial failures (label assertions plus dependent reload/parent failures).
The 75,361-byte result `legacy-chooser-candidate-complete-final.tap` has SHA-256
`9ebaf964dbba1adcd4d8b925e9ae74ddda3b7ce7e1a15e2798640bd279d61fc3`.

At this commit, the matching four-file unchanged-source control is still running
within its declared 600-second process limit. It loads the app and all four test
modules directly from exact `cce49c81` Git bytes, records each module identity,
and uses the same existing CI readiness settings as the candidate comparison.
Its complete opening campaign route has passed; the authored route is still in
progress. The remaining failure inventory has not yet been declared equivalent.
No failed regression is counted as a pass, and no comparison timing is native
browser performance evidence.

A separate unchanged-application control reproduced the saved-theme assertion
failure: the actual durable object is a
`revealline-capture-presentation-session.v1` envelope whose
`session.themeId` is `border-bloom`, while the old test reads `saved.themeId`.
The control loaded the exact `cce49c81` app bytes through an isolated Node module
loader and used the existing CI readiness allowance. Its red result is retained
as `cross-pack-save-cce-control-ci.tap`. An exploratory test correction verified
the contained native replay/checkpoint, then exposed a further skipped-ID
expectation failure (`cross-pack-save-corrected.tap`). That unrelated correction
was withdrawn; the committed test still asserts its original save/progress
premises. The earlier control with the local readiness allowance failed before
reaching the schema assertion and remains separate.

The complete `solo-performance-host.test.mjs` file passed independently: 7 tests,
0 failures, exit 0, 110.071 seconds. Its 1,933-byte raw TAP is retained as
`legacy-chooser-host-final.tap`, SHA-256
`1322102b3f0d612397bd72565fe41e599ae72da14283c5a28e57fc60d9f09df8`.
It covers the public navigation/backup regression, diagnostics, timing schedules,
interruption boundaries, renderer recovery and twenty earned Retry cycles in the
modeled host. It does not measure native browser execution.

This is a new application revision. Historical native observations retain their
original source identities. The `cce49c81` normal-package build timed out without
a candidate package; final-source qualification needs a successful new production
artifact. The static chooser import remains eager: this change proves removal of
unused construction and retained DOM, not reduced module evaluation, a measured
millisecond saving, a native performance pass or physical-device qualification.
