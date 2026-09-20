# Authored Journey mode entry

Solo and Versus share the explicit `opening` or `authored` library route. Switching modes opens the destination mode’s own cursor and difficulty context. It does not convert a run, select the source mode’s mission, transfer an award, or create a Versus save.

## Departure and return

Ready and completed attempts can switch directly. An unfinished Solo flight uses the existing checked save, replay reconstruction, readback and storage ownership checks in its exact `revealline.suspended.journey-<route>.v1` slot. Stay cancels waiting and retains the paused attempt and opener. A failed save leaves a visible session-only warning and a deliberate Leave decision; it never promises recovery. A changed saved record requires another explicit review before leaving.

Returning to Solo opens its title. Continue remains a deliberate action and reconstructs the retained checkpoint and authored picture from its original campaign identity. Legacy saves and return-token records are not used for authored mode entry. Each mode’s existing Journey profile cursor and completion receipts remain independent.

An unfinished Versus race uses the existing Stay/discard decision. Stay preserves both paused boards. Leaving discards that page’s unsaved race. Neither departure nor returning from another mode automatically starts or resumes play. Existing controller assignment, neutral-input and focus protections remain authoritative.

## Separate Team experience

Team links are labelled **Separate Team arenas** in authored Solo and Versus. They open the existing Team arenas and import workflow, not authored Journey Team missions. A `journey-return=opening|authored` hint plus exactly one `return=solo|versus` retains only the fixed return destinations. It does not select an arena, import a pack, modify rules, or grant progress.

Unknown or duplicate hints and competing launch/return-token owners use historical defaults. All destination URLs are code-owned relative paths within the current build. Team’s existing Stay/discard and explicit Resume behavior remains intact. Persistent co-op saves are not introduced.

## Slow and failed startup

The small classic `game/couch/mode-entry.js` initializer prepares native Versus Back and Team header links before the heavier mode import. The finite routes match `authored-mode-routes.mjs`, including the visible Team Back label. Its checks run independently of host preparation, so a delayed or failed import does not send an authored player to an unrelated Legacy page. The existing loader owns progress, retry and failure reporting.

## Verification and maintenance

Use the mounted-host tests for both library routes, ready entry, checked and denied Solo saves, cancellation, exact saved checkpoint/picture restoration, and unfinished Versus/Team Stay/discard. Bootstrap tests run the actual classic script without importing a game host. Keep the ordinary Solo, Versus and Team departure cohorts passing. Frozen historical releases remain unchanged.

Native checks must distinguish keyboard activation, pointer/touch activation and physical controllers from modeled input. Verify loading links, retained Solo Continue, both Couch pause decisions and visible return targets. Source tests and local browser checks do not establish public-release acceptance, offline readiness or complete campaign qualification.

Prompt: “Exercise authored Solo → Versus → Solo, including a saved cut, cancellation while retention waits and denied storage. Confirm the exact checkpoint and original picture after explicit Continue, unchanged Legacy storage, independent receiving-mode progress and no automatic play. Then enter separate Team, cancel departure, and return through each supported origin. Hold or fail mode loading and verify the native Back destination and label before host readiness. Reject duplicate and competing route hints.”
