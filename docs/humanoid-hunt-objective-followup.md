# Hunt objective and lesson-copy follow-up

Date: 2026-10-02. Reviewed after syncing `630f744f7`, with the existing automated-test waiver unchanged.

## Changes

The authored six-lesson sequence remains contact → interception → enclosure → guard evasion → combined routes → final Hunt. Its source text, target populations, campaign revisions, runtime recipes and execution keys are unchanged. Selecting another encounter variant now projects conservative guidance from the selected level instead of presenting the original lesson as if it still applied. For example, Off on First contact explains the ordinary capture goal without asking the player to touch an absent runner; Hunt on Close the bay explains its derived all-target objective rather than the authored 40% plus two-target requirement.

The projection covers Solo and Versus manifest lesson text and mission cards, plus Team Journey details and diagrams. Team's canonical rows and manifests remain the exact objects used for gameplay, artwork ownership and progress. Its display helper caches only the six supported variants and creates a diagram lazily when a card is requested. A locale change reprojects English/Ukrainian text without changing an accepted gameplay identity.

Loaded published Solo chapters now expose the same selected-variant details as their cards. Unloaded chapters retain their existing published metadata fallback; reading their details does not fetch or compile a chapter. Host selection and restoration continue to own the accepted execution key.

Team setup guidance now uses the accepted run level when a run exists, or the prospective supported variant before launch. This aligns the goal, threat explanations, briefing and support advice. Dedicated Hunt no longer describes retained relay cores or coverage as required victory objectives; those features can still provide tactical benefits.

## Direct evidence

These were focused compiler/metadata inspections, not a gameplay test suite or human play qualification:

- Solo Off / First contact displayed “Reveal 30%” and no optional targets. Its execution key and serialized campaign levels matched the existing raw Off compilation exactly.
- Versus Hunt / Close the bay displayed all six targets and no required capture percentage. The selected runtime quota was six.
- Team Off / First contact retained its ordinary drifter marker and removed optional target markers. Team Hunt / Close the bay displayed six humanoid markers, the all-target objective and a shared-route recommendation.
- Changing the locale to Ukrainian updated an already selected Solo manifest and the Team details. Original source JSON was unchanged. Team canonical row/manifest objects and their serialized contents were unchanged.
- Source review traced Versus acceptance through its immutable round recipe. Both boards receive the same level and options in `createDuel`; both advance before the winner is evaluated. Pause/Resume retains the current match. Retry retains the accepted same-mission Hunt tuning. Prospective selection is separate from the current round.

The Versus radio-setup restore key is not a durable gameplay journal. This review does not claim reload Continue support or qualification for Versus from Solo/Team save evidence. The published-details adapter was inspected at source level; final distribution/browser validation belongs to the integrating task.

Source syntax and scoped ESLint/formatting checks cover this change. Automated suites remain **WAIVED_SKIPPED_NOT_PASSED** under `publishing/test-policy.json`.

## Remaining manual checks

1. Play all six authored lessons using their original variant, then sample Off, Patrol and dedicated Hunt. Check the ready card, paused details, HUD, library route, diagram and result in English/Ukrainian. Finish the final Hunt below its retained 50% tactical coverage value and confirm that every surface explains the all-target win.
2. Restore a historical Solo level-v8 optional-patrol save containing a warning or shot after changing global encounter and presentation preferences. Confirm the historical cut-only body rule, accepted lock/shot state and exact source identity remain intact.
3. Save a Solo Hunt after one elimination and a partial quota; change global variant/difficulty and reload Continue. Inspect targets, Hunt points, actor state and warnings against the accepted recipe. Retry must restart that recipe; starting a new mission may use prospective preferences.
4. Continue Team Hunt from ordinary Journey and installed sources after both pilots have acted. Inspect partial quota, score, rescue state and exact progress-owner binding. Inspect both coverage-before-quota and quota-before-coverage cases. The separate Team persistence follow-up owns journal/progress fixes and their evidence.
5. In Versus, inspect equal accepted populations, class, speed and seed on both boards. Change global preferences while paused, then exercise Resume and Retry; only the intended next/new mission should adopt a prospective recipe. Check a same-tick finish without introducing seat-order advantage.
6. Human players still need to qualify slowest permitted classes, keyboard/touch/gamepad interception comfort, keeper readability, guard warning clarity and whether an easy first enclosure trivializes a dedicated Hunt. Structural admission and metadata correctness do not satisfy these gates.
