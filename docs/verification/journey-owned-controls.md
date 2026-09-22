# Journey-owned Skip control

## Reproduction and correction

An imported Classic flight running inside `?journey=1` exposed Skip mission even
though `journeyMission()` returned no owned mission. Its previous click handler
treated that missing mission like the end of a Journey and opened the Journey
chooser. The new real-host regression failed on the visible Skip before the fix.

The control now shares one ownership predicate for visibility and activation:
Journey must be enabled, the current mission must belong to it, and the host must
not be in Practice, a scenario, a course or a campaign overview. A queued event
for an unowned mission does nothing. Selecting an owned mission restores the
control. Existing two-activation Skip semantics, reversible selection and no-clear
awards are unchanged. At the final core mission the same optional chooser action
is labelled Find missions, not a promise to skip to a nonexistent next mission.

The ownership regression uses the real import/install/play and save-import
handlers. It checks an imported flight, chooses an owned Journey mission, then
restores the original imported saved cut. The restored checkpoint is exact, Skip
is hidden, a directly delivered stale event cannot open the chooser, and no skip
or clear is awarded. The separate final-mission test verifies Find missions,
unchanged attempt identity and no fictitious skip receipt.

## Verification

On Node 20.19.5 and 22.22.2, all eleven Journey-host checks and the new ownership
regression pass. This includes ten consecutive real-host clears with only Next,
two-action Skip, session-only storage failure, automatic defeat recovery, cancelled
cold loading, same-ID edited-content rejection and campaign-boundary failed-load
recovery. The final expanded import/save-restore ownership check also passes
separately on Node 20. Eight focused candidate-host cases pass on each version:
final-core navigation, failed cross-pack Skip and retry, failed picture retention,
all three preset boots, Skip with saved-media restoration, and result Retry.
The five unrelated candidate cases were explicitly filtered, not counted as passes.
ESLint, Prettier and `git diff --check` pass.

Native local sampling used exact commit `91c41d8901e358d2952a340c33a927c2ce1e8db4`.
Crossing complete correctly still offered Skip because it is not the last core
mission. The optional chooser's Home signal search selected the actual last core
mission; the running HUD offered Find missions, which opened the chooser while
retaining the attempt. The imported/save-restored ownership evidence above is
automated host evidence, not a claimed native import session or human test.

This patch does not alter maps, physics, progress identities, Legacy completion
copy or the other owner's completion/Next work. It is a local technical correction;
accepted-source integration and public Pages verification remain required.
