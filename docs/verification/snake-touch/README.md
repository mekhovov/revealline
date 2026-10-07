# Shared Snake touch controls

Verified 2026-10-05 against the touch follow-up to `55dc4c2db` on
`codex/snake-continuous-play`.

## Change

Snake now uses the main game's `attachTouchSteering` implementation for floating
stick, continuous swipe and slideable D-pad input. Main, couch and Snake controls
share `game/ui/touch-steering.css`; hosts retain placement and simulation ownership.
Shared mode, hand, size and opacity preferences apply directly, including opacity
below the previous Snake-only 0.75 floor. Snake's optional relative-turn buttons
remain available within D-pad mode.

Solo and Versus support board gestures and a dedicated steering surface. Team has
two labelled, independent surfaces because its shared board cannot identify which
player owns a touch. Releasing a finger preserves Snake's heading. Menus, pause,
retry, cancellation, resize and page departure clear active captures and feedback.

## Automated checks

- `node --test game/test/classic-snake-ui.test.mjs`: 71 passed, including 11 new
  touch regressions using the real shared gesture/preference modules. Coverage
  includes immediate movement, sliding, pressed feedback, assistive clicks,
  duplicate-click prevention, Team/Versus seats and gesture cleanup.
- A final accessible-group-label adjustment was followed by
  `node --test --test-name-pattern='Snake touch' game/test/classic-snake-ui.test.mjs`:
  11 passed, 60 skipped by the filter.
- `node --test game/test/pause-layout-contract.test.mjs game/test/touch-steering.test.mjs game/test/couch-shared-touch.test.mjs`:
  46 passed.
- `node --test scripts/test-offline-core-closure.mjs`: 7 passed.
- `node --test --test-name-pattern='shared Snake launcher' game/test/edition-runtime.test.mjs`:
  1 passed, 15 skipped by the filter.
- `npm run lint` and `npm run validate`: passed, including localization and
  byte-identical shared projections. Changed-file formatting and
  `git diff --check` passed.

## Browser evidence

Used the local preview at port 50361 through the in-app browser. No page-state
injection was used. A native browser drag queued an upward turn during play.

- [Solo floating stick, 320 × 640](solo-stick-phone.png): complete board and
  steering surface remain visible; the surface is 156px and honors 0.55 opacity.
- [Team D-pad, Ukrainian, 320 × 640](team-dpad-uk-phone.png): separate 150px pads
  with 50 × 50px direction buttons; no horizontal overflow.
- [Team D-pad, Ukrainian, 740 × 360](team-dpad-uk-landscape.png): independent seats
  flank the complete field; no horizontal overflow.
- Solo left-hand D-pad was also checked at 320 × 640: 52 × 52px direction buttons.
  Closing settings returned to pause, without resuming the game.

Test preferences were restored to floating stick/right hand, the viewport override
was reset, and the temporary test tab was closed. The user's preview tab and server
were retained.

## Limits

Browser drag and responsive checks do not substitute for testing on physical
touch hardware. Two simultaneous player inputs are covered by automated pointer
tests. No fresh full ZIP build was run with disk space constrained; the added
stylesheet is covered by source/offline closure checks and the build inventory
assertion was updated.

Earlier broad CI failures at `55dc4c2db` in mission-library host navigation,
Solo continuation timing and edition cosmetic-host timing are separate release
validation gaps. This touch change does not claim to resolve them or to be merged
or publicly deployed.
