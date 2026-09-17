# Controller Practice keyboard exit — v0.59.1 candidate

The embedded game previously wrapped keyboard focus inside its menu. A first exit correction exposed a second problem: the child blur repainted Pause and reclaimed focus from the parent. The final correction performs a registered same-origin handoff at nonmodal Tab boundaries and preserves focus when Pause is already visible or the document is inactive.

The complete [candidate record](candidate/README.md) binds the eleven implementation/test/guide/skill/prompt paths to immutable v0.59.0 source `76dc4bf36baec11ce4dff6ca49773d3b9d6c0ae5`. Those base bytes match the current main cutoff `2f6a563cbd3ff47c56b40aa7269fb48ca26f2838`. Integration additionally synchronizes package, lock and build version to 0.59.1, updates the execution register and preserves public v0.59.0 evidence. No simulation, save or replay format changes.

All six complete affected test files pass 160/160 on Node 20.19.5 and 22.22.2, without skipped/cancelled/todo cases. These are repeated runs of the same cases, not 320 distinct tests. [Independent review](independent-review.json) found no actionable runtime defect and independently verified candidate, base and retained-result pins; it did not rerun native checks or the full suite.

[Actual browser observations](native/observations.md) verify Ready and paused forward/backward exit, retained Restart focus after Settings, modal containment, remaining paused after focus return, and explicit Resume followed by an actual 52.2% win. Runtime app bytes match the candidate. Screenshots were inline-only; no exported images or physical-controller evidence are claimed. Moving-cut blur is covered by the actual-app host regression, separately from the still-open native lifecycle check.

Final committed-source six gates, production reproduction/readiness, ordinary build, immutable publication and public patch verification remain required. Whole P03 remains implementing. The public v0.59.0 byte audit and player observations are stored separately from this patch; they cannot qualify its successor.

The implementation follows [WAI-ARIA modal dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) for real dialog containment and [Xbox navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) for predictable focus. The practice frame is not itself a modal dialog.
