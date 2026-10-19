# FPV flight widgets and unified level picker

## Changes

- Flight guidance has a dismiss button and an Off option under Settings → Accessibility → Flight guidance. The choice survives reloads and is shared by Academy and Worlds. Restoring guidance uses the same setting. Dismiss returns keyboard focus to the flight viewport.
- The drone response close button uses a plain × with a 44 px target. The material theme previously enlarged and decorated this small overlay control. Its compact widget now stays in the lower left.
- Passive stick monitors are larger, labelled and easier to read. They reuse `mountStickTrace`, already shared with Academy and the lesson coach. Actual radio movements remain visible while paused. Reduced motion and unavailable-input resets still apply. Existing size and opacity preferences remain available.
- Menu remains accessible in compact flight. Ready regional flights use Resume; active flights use Pause, with the corresponding icon. A map that cannot resume still opens its recovery menu and explains why.
- Radio arming instructions remain visible while paused even with guidance disabled. Polling retains the correct instruction for an OFF arm switch. A saved verified radio is selected by default only if the player has no saved control-source preference.
- One selector now covers built-in lessons, installed packs, downloadable world routes and regional maps. The initial catalogue contains 269 entries: 204 built-in courses/lessons, 41 published routes from 20 downloadable worlds, and 24 regional editions. Saved regional editions outside current offers are included too. Regional families group editions without merging their exact content identities.
- Download & play prepares the selected exact revision in place. Random uses the visible search, collection and edition results, including downloadable content in the SIM. Campaign controls remain navigation anchors. Other games retain their existing ready-content-only Random behavior.
- Missing or corrupt regional scenery can repair the exact offered revision. Other saved versions remain intact. Downloads retain size/hash validation, cancellation, bounded deadlines and deliberate arming.

## Causes

The flight layout hid every toolbar item except Pause and Camera. In a paused regional flight that removed access to the menus/settings needed to resume and check the radio. Arming feedback was also hidden with the old HUD. The connected physical transmitter was recognized; an arm switch already ON needed a deliberate OFF → ON transition.

The mission registry was populated only from built-in and installed WorldPack courses. Regional maps and remote world offers belonged to separate catalogue views, and the legacy Random action used the smaller catalogue. The common registry now adapts all three sources while each source keeps its own verifier and launch path.

## Verification

- The player confirmed that the physical radio controls Railway Valley. The local UI also showed active radio input, changing flight telemetry and a Pause control during flight.
- Desktop browser: restored guidance from Accessibility, dismissed it directly, checked the corrected close control and larger sticks, and downloaded/opened Railway Valley regional preview directly from the common selector.
- All 300 automated checks passed. Coverage includes both SIM hosts, guided/manual radio regressions, paused switch feedback, regional arming/recovery, common selector Random, exact downloads, cancellation, corrupt downloads, repair, HUD persistence, shared trails and generated optional-package projections.
- Route-label snapshot generation verifies every published pack hash and course count. `scripts/refresh-fpv-world-library.mjs --check` checks that snapshot. Shared shell and reaction projections have their own `--check` commands.

The local source server runs at `http://127.0.0.1:8768/optional-practice/fpv-worlds/index.html?lang=en`. Its download worker uses the canonical generated-worker handler; offline runtime preparation still requires a full built package.

## Design reference

The [VelociDrone desktop manual](https://www.velocidrone.com/desktop_manual) documents separate controls for navigation guidance, the stick overlay and transmitter stick mode. The SIM keeps these preferences independent, and uses the existing shared movement visualization instead of adding a separate flight-only implementation.

## Scope

Work is isolated in `go_test_radio_fix` on `codex/fpv-flight-widgets-world-picker`, starting from main at `1b9052b02` and rebased onto updated main at `55506d87e`. Existing changes in the original `go_test` checkout were left intact. These changes are not deployed to the public site.
