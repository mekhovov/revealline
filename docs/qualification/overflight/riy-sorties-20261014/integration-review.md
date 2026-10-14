# Shared integration review — 14 October 2026

The complete scoped command `node --test game/test/overflight*.test.mjs game/test/raid*.test.mjs` finishes with **291 tests passing, zero failures or skips**. The receipt is `integration-tests.tap`. This includes the shared simulation, character handling, Raid variants, escort behavior, authoring/community, controller, renderer, lifecycle and presentation suites available when the command started.

The initial combined run exposed missing fixtures in the sparse checkout and the obsolete two-operation navigation expectation. Only absent tracked HEAD fixture bytes were restored. The navigation test now checks all five supported operations and their operation/locale query strings. A contemporaneous Marathon transaction assertion was resolved by the variant owner before this complete rerun. No expectations were weakened to hide a gameplay failure.

Code review checked:

- Controller Focus edges are latched before the frame clock, so a 120 Hz render frame without a 60 Hz simulation tick does not discard them. The command is consumed by the next accepted step. Pause/release clears a queued command; catch-up steps remain bounded far below the minimum command cooldown.
- Hull initialization and replacement use the selected maximum in both Survivor and Raid. Benchmark fixtures keep balanced handling; appearance alone does not enable mechanics.
- Raid record identities include enabled handling traits, and variant queries preserve that separation. Retry creates fresh run state; continuation deliberately preserves resources.
- Riy keeps two distinct escort roles, with authored positions, movement, focus timing, ranges and attack parameters. Configurable formations meet this delivery's role/formation scope; additional roles are not required for the accepted two-escort design.

Three concrete UI/content findings were reported to the implementation owner and corrected: changing difficulty dropped the current seed from the generated layout; clicking Focus left a focused button suppressing keyboard flight; and Riy's wrapper format was incorrectly labeled as legacy Survivor content in the mission browser.

A further integration edge was corrected: applying changed next-sortie airframe/slow-resume settings when starting a continued Marathon contract could recreate the run and reset the chain. The native continuation now starts with `retainRun: true`. A follow-up host test uses Acorn to extract the production `start` function and its real continuation callback, executes both in a VM with mocked owners, and confirms the existing build, hull, airframes, handling and escrow survive changed options/appearance. It also confirms ordinary ready launches still recreate for changed settings and prepare changed appearances. `continuation-host-tests.tap` contains all 20 host tests passing after this addition; native browser review remains separate.

This is code and automated-test evidence. It does not claim physical-controller testing or measured browser/GPU performance.
