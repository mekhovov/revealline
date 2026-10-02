# Company appearance localization and explicit candidate adoption

This work uses the production Company Studio entry and native controller host in the existing finite DOM test harness. It does not claim real touch, physical controller, screen-reader, GPU or pixel-layout qualification.

Implemented:

- Live English/Ukrainian heading, help, scoped labels, inherited/default choices, theme names, exact revision labels, Apply actions, review/success/error/recovery messages and pending-candidate scope explanation.
- Language changes update owned text nodes. They preserve the current selector instance/value, focused control and unapplied catalog JSON.
- The appearance section has an accessible heading and description. Company and game-theme selectors explicitly reference their caption with `aria-labelledby`, so the name is independent of the selected option. The theme gallery accessible label updates live with language.
- Applying a default preserves focus on the corresponding replacement action, including controller Confirm and subsequent neutral polling.
- An Asset Studio handoff is a bounded, one-use session transfer. Opening it only stages the candidate; exporting before Apply still exports the original catalog. Explicit Apply registers the exact candidate and sets the selected community/campaign default. Export then includes that immutable candidate.
- Missing/expired handoffs leave the draft usable and display translated recovery text. Edited catalog JSON blocks Apply without losing edits.
- Assignment scope is stated explicitly: custom interface with the candidate's exact installed Arcade/SIM collections. Edited asset-slot refusal is translated; custom asset publication remains its separate workflow.
- Runtime notices for missing exact themes, failed stylesheet loads, read-only preferences and denied game/SIM appearance storage are translated at the existing DOM theme-host boundary. Live language changes refresh status text without reloading the accepted presentation or writing preferences. Pure validator diagnostics retain their exact contract text.

Validation:

- `focused.tap`: 66/66 pass across actual Company Studio host, community appearance contracts and localization runtime. Includes five new appearance journeys and existing Company operation/controller lifecycle checks.
- `theme-family-labels.tap`: the actual Versus controller journey passes with live EN/UK caption/gallery labels, stable focus, no writes during selection/cancel, and unchanged Ready/gameplay checkpoint.
- `company-studio-host.tap`: initial 40/40 host run; superseded by the expanded focused run containing the additional controller-Confirm case.
- `i18n-check.log`: generated catalog consistency and localization validation.
- Syntax check on Company Studio and ESLint on its host tests passed.
- `notice-host-regression.tap`: 28/28 pass across final runtime notice tests and the existing unified appearance, curated community theme host and Sentinel host regressions. The six new notice tests exercise EN/UK fallback text, retained snapshots/preferences, unchanged storage, and locale-listener cleanup. The combined result is recorded in `checks.json`.

No player preference writes, source content changes, publication or commits are performed by these tests. The test export uses generated Acme source fixtures.
