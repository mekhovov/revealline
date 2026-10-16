# Shared iPhone menu repair — 2026-10-14

## Completed

- Replaced conflicting landing grids and `display: contents` ancestors with real shared identity and action containers across Solo, Team, Duel, Snake, Survival/Raid and SIM.
- Kept primary actions, sound/fullscreen controls and footers in normal flow. Portrait scrolls when required; landscape uses two columns. Safe-area padding protects controls near notches and the home indicator.
- Standardized logo crop/size, primary action sizing, utility separation, compact More expansion and Ukrainian label wrapping.
- Hide unsupported fullscreen controls; the remaining utility uses the available width. SIM follows the selected interface theme instead of always displaying the workshop image.
- Keep Duel branding visible while preparing pictures. Moved its lifetime/enemy details to Data settings and detailed presentation status to Content. Existing loading cancellation and recovery actions remain available.
- Made the shared game shell load its pause and settings styles. Snake and Survival now receive the shared pause layout; modes with two mission actions fill their row.
- Organized Survival and Raid settings with the same eight categories used elsewhere. Reparented existing controls, preserving IDs, handlers and preference owners. Added the existing shared controller, profile recovery, storage, offline, help and update tools without duplicating the offline panel.
- Verified Survival/Raid's legacy settings container retains no interactive controls, no duplicate IDs are introduced, and destruction audio remains in Audio. Category Back returns to the category list before closing Settings.

## Verification

- 145 passing focused tests: native landing structure/whitelists/fullscreen/global settings, shared shell/pause hierarchy, Couch lifecycle, Survival host, settings views and offline dependency closure.
- 10 passing controller/navigation tests, including the logical landing action cycle.
- ESLint, formatting, localization validation and generated SIM projection checks.
- Browser checks at 320×568, 390×844, 568×320, 844×390 and 1440×900, covering all six landing destinations plus Raid, expanded/collapsed More, settings and representative pause/gameplay transitions.
- Observed Duel's Down sequence: Start → Missions → Settings → Sound → Fullscreen → selected mode. SIM's mode-to-primary-to-missions-to-settings sequence also checked in the browser.
- Browser verification used a separate no-cache localhost fixture with a test-only password verifier in HTTP responses. Production password source was unchanged.

These are desktop browser checks at phone viewport sizes, not physical iPhone Safari or physical controller certification. Screenshots show the tested Ukrainian interface; native fullscreen was available in this browser. Unsupported fullscreen is covered by a dedicated test fixture.

## Remaining and related work

1. **High priority: physical iPhone Safari retest.** Check portrait/landscape rotation, safe areas, browser bars, large text, touch scrolling and returning from gameplay across all modes. This is required to confirm the reported WebKit painting problem is resolved on the original device.
2. **High priority: real controller/D-pad retest.** Automated input tests cannot certify Bluetooth reconnect, hardware mappings or iOS controller behavior. Check category navigation, Back, More/Less and native selects.
3. **Related PR #1165 remains separate:** restores Raid as a choice on Survival's home screen and adds further native menu navigation improvements. This patch preserves the existing operation choices under Gameplay settings; it does not duplicate that pending home-screen change.
4. **Related PR #1170 remains separate:** extends the existing client-side password screen to all pages. This UX patch does not change access protection.
5. **Merge and deployment are pending.** This report describes the branch, not a released build. Old offline-installed versions will require their normal update flow.

## Screenshots

- [Snake landscape](snake-landscape-uk.png)
- [SIM landscape](sim-landscape-uk.png)
- [Duel landscape](duel-landscape-uk.png)
- [Survival portrait](survival-portrait-uk.png)
- [Raid pause](raid-pause-uk.png)
- [Raid shared settings](raid-settings-uk.png)
