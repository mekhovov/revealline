# Historical native/radio integration input

This document retains the original candidate record from commit
`07973db716b939d34e01d46f36666c2182980c7b`, path
`docs/radio-integration-review.md`. It describes the earlier c99-based candidate,
not the accepted main source, a current test result, or publication approval.
Its failed and incomplete checks are intentionally preserved as historical evidence.
The original commit, branches and other records remain unchanged.

The section below is retained byte-for-byte (UTF-8, including its final newline):
3,154 bytes, SHA-256
`ff73280df96c7e3d61467108f2e94a16af358735d7fa69e404ac988deda36ef6`.

---

## Combined native candidate input (2026-09-29)

`codex/radio-release-input` starts from PR #796 source
`c99fbbac348691bb91bd16a7e1e281f5a9e2b69b` and applies only the radio delta
`2218f3cc2..6d19567cc`. Original radio source and qualification above remain
separate evidence. PR #797 owns scheduling for milestone v0.150.0; this branch
is a prepared integration input, not a standalone publication or frozen artifact.

Six content conflicts were reconciled without replacing the native shell,
spatial-audio hooks, controller confirmation lifecycle or cached-page recovery.
Both existing cached-page FPV tests and new axis-switch/default-profile tests
remain. The old Solo test's translated close-button label was replaced with its
stable settings-close hook. The donor shell-test hold workaround was removed
in favor of the aggregate's original Confirm pulse. Documentation now distinguishes
standard-pad rejoining from saved radio restoration and describes the included
optional FPV package correctly.

Focused checks on this combined source:

- 74 controller restore/session/setup, Solo adapter and FPV radio/UI tests pass.
- Three real Team host fixtures pass: shared radio, two radios, and radio plus
  gamepad; each verifies disconnect pausing and partial-profile touch fallback.
- English/Ukrainian catalogue completeness, interpolation parity and exact
  generated bundle match pass. Scoped ESLint and the couch/FPV compatibility
  check pass. Full localization content extraction was not run because the
  small checkout omits unrelated historical authoring inputs.
- The wider navigation/input/shell cohort completed with 73 passing tests and
  six failures: three missing sparse fixture imports (subsequently hydrated),
  two Sentinel route checks and one controller echo fixture. A Team host cohort
  passed 98 checks and failed its Extras test plus the then-missing Solo fixture.
  These partial cohorts are not a release qualification.
- Exact unmodified c99 baseline replay of the four substantive failing cases
  passed both Sentinel routes and the echo test; Team Extras failed identically.
  The baseline test confirms only Team Extras is pre-existing. Sentinel failures
  on the combined input remain open and must be resolved before promotion.
  A second run confirmed that the aggregate Confirm pulse fixes the echo fixture;
  both Sentinel cases still failed with an extra zero-time release sample. That
  ineffective sample was reverted; no route or checkpoint expectations changed.
- After hydrating Solo dependencies and correcting its close hook, the Solo
  radio host fixture reaches settings and saves calibration but does not start
  through the native shell; this combined-path gate remains open.

No default/optional full build or hardware testing was performed for this input.
Earlier donor build and hardware receipts must not be presented as qualification
of these combined bytes. Final controller/keyboard host regressions, source-bound
presentation/audio review, complete packaging budgets and frozen publication
remain coordinator-owned gates. No caps, assertions or simulation rules were
relaxed to admit this input.
