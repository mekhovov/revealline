# Unified game menus — local verification

Based on `origin/main` at `21826c460`. Work is isolated on `codex/unified-game-menus`; the pre-existing checkout and its uncommitted changes were preserved.

## Behavior

- All five mode choices use one renderer and icon family: Solo, Team, VS, Snake, SIM. Player-count badges and the SIM beta marker remain separate from the compact labels. Only the current mode receives selection styling; directional focus never changes modes.
- Home keeps play, mission selection and Settings prominent. Sound and fullscreen share a separate utility row. Guides, saved Team hunts and Versus recovery tools move with their original handlers into Settings. An unsaved-progress warning still provides direct access to recovery.
- Snake and SIM reuse the shared mode shell and native settings category navigation. Real controls retain their handlers, values and IDs; mobile Back first returns to the category list, then the original menu button. SIM mode switches enter Home while explicit lesson links keep their destination. Optional package projections are generated from shared sources rather than independently maintained menu implementations.
- Pause uses Resume, a compact Restart/Skip/Random/Choose row, audio, configuration and Home. Solo's level link and information controls move into mission selection; nested Back restores the actual opener without resuming the flight.
- Loading screens hide the old setup layouts while keeping status and recovery available, including errors after the initial Ready handoff. Wordmark buttons no longer show a second menu icon.

## Browser observations

Local Chromium browser checks cover Solo, Team, Versus, Snake and SIM, including 320px Ukrainian layouts, portrait and short landscape. Verified mode selection, label fit, utility placement, mission entry, pause, Settings and the Versus save-recovery shortcut. Solo's mission chooser contains the moved level-link and information controls. The local browser reported a Journey storage timeout; recovery remained reachable and the timeout was not hidden.

Controller tests use simulated input, not physical hardware. No publication or native-device qualification was performed.

## Automated checks

- Final shared mode choice, category navigation, landing structure and pause presenter run: 13/13. Earlier native category/control ownership suites also passed.
- Solo pause: 5/5; Steam Deck confirm/release: 11/11; fullscreen: 4/4; Journey menu return: 12/12; collection keyboard/controller navigation: 2/2.
- Versus startup focus and early/late error recovery: 15/15.
- Snake and shared mode shell: 39/39. Academy, SIM Worlds and optional package checks: 56/56, including preservation of every authored settings control and nested focus return.
- Core offline dependency closure and optional package reproducibility/budget checks. The extra Civilian Flight Gym consumer also packages the shared pause stylesheet.

These are targeted regression suites; the entire repository test suite was not run. Initial broad concurrent host runs hit startup timing limits; the affected suites were rerun with limited concurrency and their existing explicit startup timeout. Final interaction assertions were retained.

One additional suite, `game/test/fpv-offline-navigation.test.mjs`, remains 1/2: the worker navigation-interception expectation fails in code and a test that are both unchanged from `origin/main`. Optional package closure and the newly added shared-asset offline dependency checks pass.

Final shared projections are byte-identical to their canonical sources (`refresh-fpv-play-shell.mjs --check` and `refresh-fpv-presentation-assets.mjs --check`). ESLint passed for all 42 changed source/test modules; `git diff --check` and formatting checks passed. The final localization check passed for English and Ukrainian: 12,932 messages and 8,990 references.

## Maintenance

Run `node scripts/refresh-fpv-play-shell.mjs` after changing the shared shell, mode picker, settings or pause layout, followed by `node scripts/refresh-fpv-presentation-assets.mjs`. Verify both generators with `--check`. Do not independently edit generated blocks in the optional simulator.

## Follow-up: actual global settings parity

The initial category-only integration did not expose all shared preferences. The follow-up adds a single logical inventory in `global-settings-view.mjs`. Existing controls are adopted intact, and optional hosts bind generated fields to their canonical preference services. The renderer owns no storage, audio engine, or gameplay lifecycle. It groups common options first, keeps mode-specific controls below them, and hides duplicate shortcuts without removing their original handlers.

Solo, Team, Versus, Snake, SIM Worlds, SIM Academy and Civilian Flight Gym expose language, the complete theme gallery/customization, text style, text size, reduced effects, menu animation, master mute and master volume. Shared menu/radio/movement cue controls retain their canonical stores. SIM-specific camera, world/interface overrides, stick guides, calibration, flight records and offline actions remain available. Team and Versus effects volume uses the existing Soundscape as a session-specific setting. Flight Gym now uses the shared mode picker and settings categories too; its workshop launcher lives in Extras and its drills, authoring and offline controls remain available.

The reusable core tools provider adds profile diagnostics/recovery, download retention, install/offline tools, Controller Lab, creator tools and About without opening a second profile writer. Nested tools restore the actual settings opener. Mode-specific progress transfer remains owned by each game.

SIM loads the exact core tools provider through a literal, same-origin import. This is an explicitly declared **optional core capability**, outside a standalone optional package's guaranteed offline closure. Package policy admits only that source file/import-expression pair; eager imports, other import sources, computed imports and non-worker fetches still face the original restrictions. When core tools are absent, the SIM retains all local/common preferences and its own backup/offline functionality and displays an availability explanation. Core tool versions follow the installed core game rather than the optional archive. No arbitrary script loader or executable URL substitution is used.

Browser checks covered the five main mode homes and their settings at 320px in Ukrainian. Changing text style/size in Snake carried into Worlds, Team, Versus and Solo. No horizontal overflow was observed. Shared recovery and Controller Lab opened from Worlds and returned to their original settings category. These checks found and fixed a migration bug where writing accessibility preferences could select a legacy theme on the next game load. Native headings and the Plain-font logo presentation were also corrected.

The same 320px review covered Flight Gym and an isolated Academy package served without the core game. This caught missing menu artwork and an initial-locale mismatch in the shared theme gallery. Both are fixed: the standalone package carries its wordmark/background and honors `?lang=uk` before mounting common settings. The standalone tools explanation is localized and no broken core-return shortcut is shown. Source-preview preferences changed during verification were restored.

Final follow-up verification:

- Snake, Academy, Worlds, shared shell, encounter audio, menu scenes, display preferences and master audio: 188/188.
- Common settings, native settings, Flight Gym, optional packaging and core closure: 49/49.
- Final explicit optional-core import boundary plus frozen candidate admission/localization for all three practice packages: 5/5. These use synthetic candidate identities and do not qualify a public release.
- Theme system, gallery and collection: 36/36; targeted accessibility/theme migration: 2/2. Nested tool ownership, recovery and simulated controller Back tests pass without resuming the paused game.
- ESLint passed for all 74 changed modules at the final source review, with the subsequent package-policy/test edits checked separately. Shared shell, presentation, Academy audio and reaction-runtime generators all pass `--check`. Final localization validation: 12,934 messages, 8,993 references. Formatting and `git diff --check` pass.

Package policy includes the two required artwork assets and canonical English/Ukrainian theme and audio labels. Academy and Worlds file caps increase by two (74 and 106); the deduplicated manifest still applies the exact allowlist. Worlds' aggregate input budget increases from 16 to 17 MiB because its reviewed input graph is 16,873,370 bytes, while runtime content remains under 16 MiB. Vendor hashes and other module/network admission restrictions remain enforced. Font and audio attribution is included for the additional Flight Gym consumer.

An unrelated broad theme-bootstrap inventory check reaches `authoring/fpv-worlds/course-editor/index.html`, which has no theme bootstrap in the baseline. That file is byte-identical to `origin/main` (SHA-256 `bbfef7c44e8bf372862db0aada6d5aa8cd47b47aa02ddb069c7e1c71793fc0fc`). Targeted theme preference/migration assertions pass; the unrelated authoring entry is not part of this change.

## Follow-up: deterministic keyboard and controller order

Every game home now publishes the same explicit directional graph. Down moves from the selected mode to Continue/Start, Select Mission, Settings, Sound and Full Screen, then returns to the selected mode. Up reverses that order. Left and Right stay in the five-item mode row and wrap in the order Solo, Team, VS, Snake, SIM. Mutually exclusive Start/Continue controls use ordered fallbacks, so hidden or disabled actions are skipped without leaving a dead end.

The graph is scoped to the visible home owner. Team and Versus controls that are reused by Pause or Results therefore keep their existing local navigation. Versus result-only Next/Cancel actions remain reachable horizontally. The optional simulator keyboard, gamepad, D-pad and calibrated-radio adapter now consumes the same semantic graph as the core controller navigator, fixing the Full Screen dead end in Worlds, Academy and Flight Gym.

Browser checks in Ukrainian verified the exact six-step Down loop on Solo, Team, Versus, Snake, SIM Worlds, SIM Academy and Flight Gym. Mode-row Right wrap was checked on the core and optional shells; Left and Up reverse movement were also checked. Controller coverage uses synthetic standard-gamepad/D-pad samples rather than physical hardware.

Final navigation verification:

- Shared mode choice, shell, native landing, controller, Snake, Flight Gym, Academy and Worlds suites: 301/301.
- Native composite keyboard/controller coverage passed for Versus and Team landing, Pause, win and loss states. The three controller cases affected by the test navigator's old home-scope assumption were rerun after aligning the helper with the production scope rules: 3/3.
- Shared shell projection is byte-identical to its canonical sources. ESLint, targeted Prettier checks and `git diff --check` pass.
