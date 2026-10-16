# TX15 full radio menus

The existing TX15 right-stick preset maps movement and menu directions, but leaves Confirm and Back unassigned. Solo players can now explicitly select **TX15 full radio menus (Solo)** in controller setup.

- The right stick moves through menus and retains the existing flight movement mapping.
- Left-stick horizontal movement (yaw) right confirms; yaw left goes back. Return yaw to centre between actions.
- The existing main-game Confirm transaction commits on release and preserves the target selected when the gesture started. Entering a new menu context or reconnecting requires a neutral sample.
- Throttle, auxiliary axes and hardware buttons are unassigned. Flight actions remain available through the existing keyboard/touch controls or the configurable action mappings.
- The shared-radio two-player presets remain unchanged. The new option is displayed only in Solo setup and cannot be applied through the shared setup handler.

The preset accepts only the existing tested descriptor: `TX15 Joystick (Vendor: 1209 Product: 4f54)`, raw mapping, eight axes and 24 buttons. Yaw uses channel 3, centre `0.004`, endpoints `-0.996` and `1`, press threshold `0.75` and release threshold `0.25`. These values match the established FPV USB Mode 2 profile; no new hardware measurement is claimed. Other transmitters and altered radio-side mixes must use measured configuration.

The implementation reuses `CouchControllerProfiles.v1`, the Solo controller session, menu router, DOM navigation and Confirm lifecycle. It introduces no new input polling or timers, no FPV dependency, and no flight-physics changes. English/Ukrainian instructions and the generated translation catalog ship together.

## Verification

The main-based candidate passed syntax, ESLint, formatting and `npm run i18n:check`. The [functional receipt](evidence/tx15-full-radio-menu-20261002.json) records 14 checks using the actual Solo radio session/router and six setup DOM-boundary checks. They cover initial neutral pickup, four directions, held/released Confirm and Back, menu/flight scope transitions, disconnect, raw-input capture, ignored channels, configurable standard-gamepad action indices, unchanged shared mappings, descriptor rejection and localized opt-in behavior.

The DOM boundary checks use deterministic geometry and do not claim browser layout. Separately, the [actual browser receipt](evidence/tx15-full-radio-menus-browser-20261002.json) records 12 passing checks using the real setup, navigation and guarded Confirm lifecycle with controlled samples. Its local fixture is `/dist/tx15-menu-verification/index.html` in the qualification worktree. The full game entry reached its existing password gate, so complete lobby acceptance remains pending; the gate was not bypassed.

Additional unit-test coverage remains deferred under the FPV delivery plan. Public deployment and new physical TX15 acceptance have not been verified for this increment.
