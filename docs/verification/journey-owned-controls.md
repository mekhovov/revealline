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

This patch does not alter maps, physics, progress identities, Legacy completion
copy or the other owner's completion/Next work. It is a local technical correction;
accepted-source integration and public Pages verification remain required.
