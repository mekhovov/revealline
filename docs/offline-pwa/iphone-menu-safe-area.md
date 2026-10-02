# iPhone installed-app menu header correction

User reports on 2026-10-02 show Settings and its Back button beneath the iOS
status bar in portrait. Gameplay's HUD already leaves the required top space.

## Cause and correction

The body owns safe-area padding, but modal dialogs render in the browser's top
layer. Solo's full-height dialog inherited `margin: 0 auto`; native Settings
limited its height using only a fixed 16/32-pixel allowance. Neither constraint
reserved the iPhone status bar. The compact layout reduced that allowance again.

The native Settings frame now subtracts the actual top, bottom, left and right
safe areas from its available size. Solo and Team modal frames sit within those
insets with fixed positioning; their existing category/panel scroll regions
remain scrollable while the header stays outside that scrolling. The nonmodal
Versus panel shares the size constraints. Home/menu padding also preserves safe
areas in narrow and short landscape layouts instead of replacing them with fixed
padding. Existing safe-area variables are reused, with direct `env()` fallbacks
for hosts such as Team that do not load the Solo root stylesheet.

This follows [WebKit's safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
No device model, status-bar height, password policy, save data or gameplay logic
is changed. The production stylesheet continues to receive generated offline
hashes during the normal build; an already downloaded app needs the published
update before receiving the correction.

## Verification

The manual fixture at `game/test/manual/ios-menu-safe-area.html` loads each
host's real Settings markup and stylesheet order, applies `prepareNativeMenus`
and the real category/back adapter, and reports geometry. It does not boot a
game, run an automated test suite, or disable the game password screen.

Run `node scripts/game-cli.mjs serve --port 8896`, then open the fixture with
`?mode=solo&insets=portrait`. Modes are `solo`, `versus`, `team`; inset presets
are `portrait` (59/0/34/0), `landscape` (0/59/21/59) and `plain` (zero).
Resize the viewport to match the selected case. The preset values are simulation
inputs only, not production constants.

Observed in the Codex browser:

- Solo, 393 × 852 portrait: frame begins at y=59; Back at y=76 with a 44 × 44
  touch target. All eight categories remain reachable. Drill into Audio, Back to
  categories, and Back to close all worked.
- Solo, 852 × 393 landscape: frame x=59/y=16, width=734/height=356, ending above
  the 21-pixel bottom inset. Scrolling the display panel to its last checkbox
  moved that panel by 387 pixels; outer scroll stayed zero and Back stayed y=41.
- Team, 852 × 393 landscape: same safe frame, Back y=41 and at least 44 pixels
  tall. Portrait and a reduced 393 × 480 viewport kept Back and the active panel
  inside the safe rectangle.
- Versus, 852 × 393 landscape: the nonmodal frame reserved both 59-pixel sides;
  Back remained inside the visible viewport.
- Desktop, 1280 × 720 with zero insets: the frame remains 1080 pixels wide,
  y=16/height=688; category selection and Back remain accessible.

Screenshots are retained in `evidence/iphone-menu-safe-area-20261002/`.
Repository validation, lint and formatting passed. Automated suites remain
**WAIVED_SKIPPED_NOT_PASSED** under `publishing/test-policy.json`.
The complete in-memory build preparation/inspection passed: 958,763,342 bytes
including its manifest. The [build summary](evidence/iphone-menu-safe-area-20261002/build-summary.json)
pins the generated manifest and changed stylesheet. This full-distribution
inventory is not the rolling Pages profile, a ZIP or publication admission.

These are browser checks with simulated insets, not a physical iPhone Safari
Home Screen qualification. Confirm the published update on an installed iPhone
in portrait and landscape, open each Settings category, scroll to the last
control, return with Back, and rotate while Settings remains open. The submitted
photos are evidence of the original defect, not evidence that the fix is deployed.

## Delivery boundary

Independent fix branch `codex/ios-menu-safe-area`, based on main `0238e6941`.
It does not depend on the larger SIM/community download PR #933 and does not
change the SIM agent's active work. Schedule through the existing release queue;
do not publish device-support claims from this fixture alone.
