# PID restoration and precision follow-up — 19 October 2026

## Outcome

PID fields show compact values without changing their exact stored gains. Focus
reveals the full value; untouched fields never pass through the display formatter
when saving, applying or testing a setup. Explicit edits retain their raw text.
All fifteen presets have no-op configuration/revision checks.

Two related recovery defects are fixed: restoring a valid draft clears stale
`aria-invalid` flags, and explicit Revert/Undo clears the previous invalid-value
message. Ordinary refresh, locale changes, storage failures and stale-library
errors retain their correct priority. Before-fix regressions were reproduced
against the original source; this is not a retuning of aircraft physics.

## Exact source qualification

Qualified combined source: `863449767ffd2390b9b3b86ddf4f68447c1c70fe`,
tree `90d0aebcbd8a988841cfd1ba7ee0bd93e0f3076c`.

- **743/743** focused checks across flight hosts, workbench, archive/reference,
  static-course, contact diagnostics, shell pruning and propulsion preparation.
- **19/19** optional-package, native-development-contract and texture checks.
- Scoped lint and formatting pass; generated shell matches the canonical-input
  projection byte-for-byte. All **243** distinct packaged input hashes and lengths
  match the exact committed tree.
- Academy uses **13,301,661 / 13,303,808** original-input bytes (**2,147 spare**).
  World has **1,179,605 spare**. File limits remain 98/151/211.
- Six unreachable private helpers remove **1,618 bytes**. Their canonical
  modules and public exports remain intact; reference/shape changes stop the
  projection before writing. No policy limit was increased.

The full focused command uses the eighteen files in the prior current-main
receipt, plus `fpv-workbench-host` and the five propulsion evidence/load/surface/
quad/inverse suites. Package checks use `test-optional-fpv-package`,
`test-build-fpv-native` and `test-world-texture-acceptance`. One preliminary
invocation resolved its cohort-list path incorrectly and ran only the six named
suites; it is not the 743-check qualification. The corrected complete command
and package results are retained with hashes in the [receipt](fpv-pid-followup-qualification-20261019.json).

## Actual browser acceptance

A fresh local World package at `709222b4311211186a8d10364330d87a6da77d0d`
(tree `7051277fa0e7dc24df143d11a06c4b478f25161e`) passed normal UI checks with
Nazgul selected and saved. This precedes only the separately reviewed private
helper pruning; it is not mislabeled as a browser run of the later source.

1. Roll P displays `0.021133602`; focus shows `0.021133601999999998`.
2. Blank Roll P followed by Save is rejected.
3. Revert restores the number, clears the error and invalid flag, and shows
   **0 changes · Saved for next flight** with comparison available.
4. The same blank/Save sequence followed by Undo recovers the draft. Running
   the native response bench finishes with **Comparison complete. Your draft
   and flight are unchanged.**
5. An unchanged Save and refocus still shows exactly `0.021133601999999998`.

There were no warning/error console entries. No flight was started or archive
removed. The temporary tab/server were closed. Screenshot:
`pid-validation-restored-709222b431.jpg` in this task's sustained-flight evidence
directory. Earlier raw-edit/high-precision and focus/blur acceptance on
`98d393ca57`, and the negative stale-status observation on `6aa0c6d45e`, remain
separate evidence.

## Related non-activating preparation

The fixed-voltage quad command inverse is included as a source-only helper,
with **80/80** focused synthetic cases (also included in the combined cohort).
It rejects singular/ill-conditioned geometry, commands outside admitted cells,
invalid power and residuals; it does not clamp or extrapolate. It changes no
live aircraft or worker. Global cell selection, battery-sag coupling, transient
response, command-domain mapping and matched validation remain in R6.

Actual completed Meteor75 Academy and Nazgul World-host Flight School flights,
including native replay verification and explicit reference selection, are
recorded in the [separate source-bound acceptance](fpv-native-course-acceptance-20261019.md).
These checks do not establish measured real-aircraft handling or all-map/platform
qualification. Final public deployment acceptance remains open.
