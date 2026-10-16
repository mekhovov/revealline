# Explicit observation policy for commanded endurance reviews

The authored Urban review can now observe its scripted pilot while the page stays
visible but the application window loses keyboard focus. This is an explicit
review-only option, not a change to SIM input or a relaxation of existing receipts.
The default remains **Strict: visible and focused**. The synthetic corridor page
continues using that strict default and does not expose the new option.

On `authoring/fpv-worlds/regions/authored-endurance.html`, select the observation
policy before Start. **Opt in: visible commanded flight; focus recorded** applies
only to the authored, automatic pilot. It does not measure human/controller input
latency or establish device FPS. The selected policy cannot change during a run.

Each new report records the policy and timestamped focus/visibility events in
`observation`. Routine frames add no redundant events. The trace fails closed if
it exceeds 1,024 entries; it never silently drops a transition. Returned snapshots
do not expose mutable internal events. Report history records available policy
metadata as unverified history. Legacy reports without that field remain
`not-recorded`; importing them never changes the current selection, combines
segments or adds elapsed time.

Both policies still invalidate hidden documents, page exit, viewport/canvas changes,
context loss, unexpected authored-route contacts, rejected active ticks, frame gaps
above 250 ms and wall-clock discontinuities. The existing elapsed-time accumulator,
route coverage, source verification, reservation/collider bounds and zero-disposal
acceptance remain unchanged. A failed segment cannot resume after focus returns.
Prepare and Start are required for another independent, zero-time segment.

Validation is deliberately separated:

- `node authoring/fpv-worlds/regions/verify-endurance-observation.mjs` exercises the
  actual policy with the actual measurement clock under deterministic event times:
  strict blur failure, explicit unfocused observation, focus trace ownership,
  hidden-tab failure, timing/safety rejection and independent segment history.
- The existing `verify-endurance.mjs` continues to cover clock invariants, an actual
  one-second Node flight smoke, accelerated route preflight and disposal. Accelerated
  ticks and virtual-time checks are not elapsed native-renderer endurance.
- Native review and a fresh accepted elapsed segment are still required. Earlier
  strict-focus failures remain failures and are not reinterpreted by this option.

Only authoring tools and documentation change. No shipped module, renderer,
physics, asset, Library pin, package limit or saved player data changes.
