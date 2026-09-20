# Journey Missions return contract

Missions is a child of the screen that opened it. Home stays mounted beneath the Journey chooser, just as it does for Collection. Back restores Home and its Missions button; opening from the field returns to that field's Missions button with the flight still paused. The footer says **Back to menu** or **Back to game** accordingly.

Only selecting a mission closes the retained Home parent before the existing staged preparation starts. This changes no campaign identity, scoring, picture ownership, storage format, difficulty or simulation. Browsing and returning grant no progress. Search and campaign filters keep their existing values.

The chooser's nested Progress backup retains its own return to the backup opener. Restoring progress still follows the existing merge policy and never replaces a current attempt. Native search controls retain their editing behavior: Escape can clear a nonempty search before a subsequent Escape cancels the dialog. Do not intercept that native first Escape merely to force a close.

## Verification

`game/test/journey-menu-return-host.test.mjs` checks title button/cancel/controller Back, explicit mission selection, paused field and Home returns, nested backup, retained search, unchanged progress and exact simulation checkpoints. Gamepad samples and cancel defaults are modeled; physical controllers are a separate requirement. Existing Journey and main-menu Collection host suites remain regression coverage.

The bounded native check uses keyboard at 1280×720: Home→Missions→Escape, search→Progress backup→Back→menu, retained search→mission selection, paused field→Missions→Back and paused Home→Missions→Back→explicit Continue. Its HUD observations do not replace modeled checkpoint identity. Full source gates and public, offline, touch-only and physical-controller acceptance belong to the final integrated release.
