# Workbench accessibility follow-up — 19 October 2026

Ukrainian desktop acceptance of the propulsion inspector exposed English accessible names on the fine-adjust buttons for inertia and PID gains. The ordinary field labels translated, but the independently assigned button labels were not registered for locale refresh. A separate Legacy-reference entry also reused a Betaflight-export error that did not explain the supported practice choices.

Reviewed source `a94e08d5d865141fd6c25380cd17e41b4521f7ac`, integrated as `3949d2f2afd1395e447de27ba906152aaec5add9`, changes only `setup-workbench.mjs`, `tuning-ui.mjs` and the focused UI tests. It registers the complete fine-adjust names with the existing translated-attribute mechanism and supplies a contextual Legacy-reference explanation. The original CLI-export compatibility error and all format guards remain intact. A physical aircraft may still retain Legacy rates; selecting starter rates is not required.

## Verification

- **169/169 focused tuning/workbench checks pass**, no skips. New regressions failed before the correction. Coverage includes initial Ukrainian, EN→UK→EN for all thirty button names, raw unfinished numeric text, undo, effective numerical configuration, untouched saved settings, and both EN/UK Legacy guidance paths. Independent review, scoped lint, formatting and diff checks pass.
- Runtime inputs increase by **486 bytes** (+132 workbench, +354 tuning UI); there are no new dependencies, file admissions, schemas, aircraft coefficients, gains, rate evaluation, recording or physics changes. The only product-source differences from the qualified `cfdf24d61` flight runtime are those two UI modules. Earlier source-bound flight evidence remains scoped to cfdf and unchanged physics, not silently relabeled as a new flight run.
- All **19 final package checks** pass again on clean committed `3949d2f2a`, tree `f9990e43814a4676262dd2aa1bd56b931ad20f3d`. [Exact receipt](fpv-workbench-labels-package-20261019.json), SHA-256 `c0fd5683619d6d65ff800e304ef73c1d6b3002f1451d4699fd2032a387c58886`. Academy original inputs are **13,301,613 / 13,303,808 bytes**, leaving **2,195 bytes**; the actual bundled Academy is **13,071,223 / 13,107,200**, leaving **35,977 bytes**. World input headroom is **1,179,664 bytes**. Native development headroom is **14,536,539 bytes**. Caps remain unchanged and original source inventories remain full (98/98, 151/151, 211/211).

## Actual packaged UI acceptance

A fresh localhost origin loaded the emitted final World artifact in the available desktop in-app browser. Settings changed to Ukrainian before opening the workbench. Legacy Advanced entry displayed the new Ukrainian guidance and left the draft unchanged. Selecting Meteor75 with **Keep my current rates** produced a seven-change temporary draft retaining **Legacy feel**.

All six visible inertia adjustment buttons and all twenty-four PID/feedforward adjustment buttons exposed Ukrainian accessible names. Incrementing pitch inertia changed **0.000012717 → 0.000012817**; Undo restored **0.000012717**. The physical Meteor75 then opened Advanced reference practice with Legacy rates retained. Returning preserved the same seven-change draft. Revert restored the original zero-change setup and Basic view. No flight was started, setup saved or archive deleted. Browser warning/error logs were empty.

Screenshot `workbench-uk-labels-fixed-20261019.png` is retained in the task's local sustained-flight visualization directory. The test tab and its temporary local server were closed. The public tab and existing archives were untouched. This is one desktop browser check; a safely controllable narrow viewport was unavailable, so narrow-layout acceptance remains open.

The observed request for `game/ui/global-settings-tools.mjs` is an intentionally excluded core-only module in standalone packages. The shared presentation catches its absence and uses localized fallback; existing package/global-tools tests cover this boundary. No additional source admission was added to hide that expected fallback.

Final review/CI, deployment and source-bound public acceptance remain in the [current completion plan](fpv-current-completion-plan.md). This UI correction does not close R13 archive retention or physical/device qualification.

Focused test log: `/private/tmp/fpv-workbench-labels-20261019-tests.log`, SHA-256 `0c6494fcbf9b984d0091a87e1fa8d28d303204a31589164ac30488da1d5715ac`.
