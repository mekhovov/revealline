# Menu typography, states and input qualification

This is bounded local source evidence for the managed `native-menus-fpv-line/go_test`
worktree on 2026-09-29, based on `c0a8757501ed84d85e8f8054d3d351a6fd557f01` plus
the files in this batch. Other agents are working on independent inputs. It does
not qualify a final package, a physical controller, native webview or published
release, and does not complete Phase 4 or Phase 6.

## Changes

- Custom player and shared support/authoring monochrome icon masks now retain the
  control's inherited system text color in forced colors. The controls themselves
  continue using the browser's palette. Custom selected modes, Settings categories
  and missions retain a double border; disabled controls retain GrayText and a
  dashed border; focus retains a system Highlight outline.
- Custom Plain now applies to the containing player body, including Settings,
  as well as its existing home-action override. Role sizes and font assets are unchanged.
- A test-only browser fixture mounts the actual Custom player HTML/menu/navigation
  modules with fixture data, and the Controller Practice HTML/shared support owner
  without the Practice runtime. Three additional samples use the production Solo,
  Versus and Team state CSS. These samples do not claim full host boot acceptance.

The source correction follows the browser's
[forced-colors paint behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/forced-colors):
background colors are substituted and box shadows disappear. Only the monochrome
mask opts out via
[`forced-color-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/forced-color-adjust),
using the parent's system text color. Browser-rendered forced-color acceptance is
still pending.

## Executable fixture

Serve the managed checkout with the existing source server and open
`http://127.0.0.1:8983/game/test/manual/accessibility/`. Choose surface, EN/UK,
Theme/Plain, Standard/Large, and normal/delayed/failed font responses. The
**Open full-page fixture** link removes the parent controls from viewport tests.

The isolated worker controls only `/game/test/manual/accessibility/`. It delays
the four explicitly named local font paths by six seconds, or returns a deliberate
503 for them. Game and authoring clients outside that directory are untouched.
The fixture uses memory-only display preferences, never installs a campaign, and
does not start a simulation. Navigation links are prevented from leaving the fixture.
The support child iframe does not boot. Keyboard menu/field behavior still uses
the production input owner; no second owner or physical gamepad is installed.

Reports are available as text in the parent and as JSON in the full-page DOM:
`script#accessibility-report`. They include the viewport, real font-face states,
intercepted font paths, focus, control names/sizes, clipping, horizontal overflow,
selected state, icon masks and the actual forced-colors media query. The first
rendered frame and font-loading settlement are separate observations. Reports
also update after focus, viewport and forced-color changes.

Use real browser zoom controls for 200%; a narrow CSS viewport or DPR alone is not
evidence of zoom. Use a browser/OS forced-color mode for that acceptance; a false
media query explicitly remains unqualified. After testing, use **Unregister fixture
font worker** and close fixture tabs. This unregisters only this fixture's worker.

## Browser observations

The parent agent inspected the fixture through the available IAB/CUA browser on
`127.0.0.1:8983`. These are component/adapter observations, not a full imported
campaign or physical-controller journey.

| Configuration                                            | Observed result                                                                                                                                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom EN, normal fonts, 1244×536 CSS viewport, DPR 2    | All six layout/name/target checks passed.                                                                                                                                                            |
| Custom UK, Theme/Large, delayed fonts, 1244×536          | First rendered frame passed with Departure Mono and Exo 2 loading. Settlement passed with both loaded. The worker intercepted both exact font paths.                                                 |
| Custom UK, Theme/Large, delayed fonts, full page 390×844 | No horizontal overflow or clipped action labels; all six visible actions had targets at least 62px high after loading.                                                                               |
| Custom UK, Theme/Large, failed fonts, 1244×536           | First frame and settlement passed all six checks. Both used font faces reported error; the worker confirmed both deliberate blocked responses.                                                       |
| Custom UK, Theme/Large, failed fonts, full page 390×844  | Layout passed; real Tab then Down reached Start.                                                                                                                                                     |
| Custom UK, Plain/Large Settings, 1244×536                | All six layout/name/target checks passed. Back, all four categories, difficulty and steering used `system-ui, sans-serif`; category targets were 54px/85px high and selects 48px. No clipped labels. |

All these observations reported `forcedColors:false`. True 200% browser zoom,
active forced colors, a complete responsive matrix for all real hosts/editions,
and native/device font behavior remain open. Plain/Large Settings inheritance
has the separate rendered observation above.

## Automated verification and input coverage

```sh
node --test game/test/menu-accessibility-fixture.test.mjs \
  game/test/support-input.test.mjs game/test/creator-player-menu.test.mjs
```

**23/23 passed** using Node 22.22.2. The new fault-injection test proves real game,
Creator, Asset Studio and cross-origin clients/resources cannot be delayed or
blocked by the fixture policy. Existing support-owner tests cover dynamic actions,
field-edit cancellation, search caret behavior, Confirm release/duplicate
suppression, child focus yielding and neutral return. Existing Custom-menu tests
cover modal/category Back, stale replacement refusal, Plain/Large preference
adoption without writes, EN/UK labels, fullscreen state, focus groups and installed
Play focus retention. Those input tests use synthetic DOM/controller fixtures.

The separate actual-Custom-runtime suite and its prior 83-case cohort remain
attributed to [the Custom report](custom-menu-2026-09-29.md); they were not rerun or
reclassified as physical input evidence by this batch. Complete creator editing,
invalid-input, preview, save/reopen and export journeys remain per-tool acceptance.

Scoped ESLint, Prettier and `git diff --check` passed. The normal build-file
collector returned **1,709 files and zero `game/test/` files**, confirming that the
fixture and its worker are excluded from the player distribution. No full build,
native package, production manifest, font asset, scene asset or runtime ledger
was changed.

Local test log: `/private/tmp/accessibility-focused-20260929.log`.
