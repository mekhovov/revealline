# Unified mode UX verification

Automated suites are waived by `publishing/test-policy.json` and were not run. Relevant regressions were authored for the shared shell, Snake, native flight hosts, navigation and Studio returns.

Mandatory localization, game validation and presentation metadata checks passed. The game validator reports seven existing links to release-generated destinations (app, diagnostics, releases, privacy and credits).

Manual browser review verified title → mission/briefing → Start → play → Pause/Continue in Snake, Worlds, Academy and the assisted gym. Snake menu arrows retain input ownership. Retry preserves the accepted URL recipe and resets its counters. Flight Settings and Back/Escape were checked against retained paused state. Ukrainian Versus was inspected at 320×740, 360×780, 390×844 and 740×360; boards/controls fit without horizontal page overflow and preserve 44 px controls. Physical two-player touch, gamepads/radios, enlarged text, native fullscreen, offline package installation and human play qualification remain deferred.

Exact committed-source production preparation and optional-package admission receipts will be recorded after the runtime commit. Full release archive creation is constrained by local disk capacity; preparation does not constitute public-release qualification.
