# Unified mode navigation and play

Main Capture Solo remains the canonical menu experience. This change brings Snake and the flight modes into the same navigation pattern: a title, mission selection, a prepared briefing, explicit Start, focused play, pause, and results. It shares presentation and input services while retaining each mode's simulation, controls, saves and record rules.

## Player navigation

1. Open the main game and choose **Solo**, **Versus**, **Team**, **FPV SIM**, or **Snake**. Snake enters its playable title rather than the campaign guide. The main Capture titles keep pursuit campaigns, private-room previews and the Snake campaign guide under **More modes and guides**.
2. In Snake, choose **Select Mission**, select Solo/Versus/Team, choose a campaign and chapter, and select a mission card. **Review mission** opens the briefing; **Start** begins the accepted attempt. All existing missions remain selectable.
3. Use **Expert options** for Campaign/Endless, pace, target rules, Endless presets, duel rules, featured sorties and an explicit new seed. These choices are secondary to mission selection.
4. During play, **Menu** or **Pause** freezes the attempt. Return through **Resume** explicitly. Closing menus with Back or Escape does not resume simulation. **Retry** creates one fresh attempt with the accepted recipe and seed. Results retain Next, final-moves playback and the optional Slow offer.
5. Open **Settings** for language and steering, with display, audio and destruction preferences grouped in disclosures. Help and **Workshop** are reachable from Settings. Workshop retains Snake Studio, the campaign guide, Capture remixes, main-game return, saved-round loading and session import/export.

A newly selected mission owns its Start action; an older saved round remains available through Workshop. An ordinary title visit may offer Continue. Direct mission links open their briefing. Snake Studio's Play actions install the validated immutable edition and open that same briefing in the selected mode. Its fixed Studio return preserves supported language without accepting an arbitrary return URL.

## Coverage and shared services

| Surface                              | Integration                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture Solo                         | Canonical native shell retained; secondary discovery closes before leaving its owner.                                                                                                                                                                                                    |
| Capture Versus and Team              | Existing shared native menus, Settings, fullscreen, controller focus and pause/departure ownership retained. Secondary discovery follows the same Back behavior.                                                                                                                         |
| Snake Solo, Versus and Team          | Shared `mode-play-shell`, mission cards, prepared briefings, secondary options, results and shared keyboard/controller menu navigation.                                                                                                                                                  |
| FPV Worlds, Academy and assisted gym | Shared-shell adapters are integrated with native course/drill selection, controls and explicit flight activation. Title, briefing, focused play and Pause/Continue were manually checked; see [flight-mode-shell.md](flight-mode-shell.md) for native differences and package ownership. |
| Creator and Studio                   | Existing editors and validation remain authoritative. Shared Studio navigation preserves bounded EN/UK context; Snake Studio's playable previews use the same preparation flow.                                                                                                          |

Snake's SIM button uses the canonical optional-package launcher with package availability feedback. Bundled launches preserve a same-build return to the current Snake selection. The launcher carries accepted appearance context and cancels pending navigation when its owner changes; separately published packages retain their existing package navigation rules.

The integration reuses the main game's theme context, wordmark/icons, modal navigation, fullscreen service, controller navigation and existing sound/preferences services. Settings are not identical across modes: Snake needs grid steering and target rules; Capture needs its capture/combat options; flight modes retain their native control axes, arming, camera and radio controls. Sharing the shell does not replace those mechanics.

## Play layout and retained options

Snake uses the available window for its HUD, board and touch controls. Menus scroll independently. Opening a menu does not shrink or reflow the active board. Fullscreen is optional; the focused layout also works in the ordinary browser window. Paired Versus boards retain their arrangement selection, and Team retains player-owned touch controls.

New Snake preferences default to the directional pad. Previously saved left/right steering remains selected. Cable/Signal, Game theme/Retro Field, cast selection, earned accents, Reduced effects, master/effects volume, reactions, optional brutality, blood and remains are retained. Progress shortcuts, personal records, fixed-seed sorties and session tools remain available in their new menu locations. No gameplay option is removed by moving it behind Settings, Expert options or Workshop.

## Verification record

Manual browser review confirmed the shared title, mission selection, briefing, explicit Start and Pause/Continue flows in Snake and the three flight surfaces. Snake keyboard arrows move menu focus without moving the drone. Ukrainian Versus fits 320×740, 360×780 and 390×844 viewports without horizontal page overflow; at 740×360 it selects paired boards. The 320 px portrait view selects stacked boards and retains 44 px or larger controls. These are browser viewport observations, not physical-device qualification.

Exact committed-source results are recorded in [verification/unified-mode-ux.md](verification/unified-mode-ux.md). Authored regressions cover menu input isolation, pause/Back ownership, accepted Start/Retry identity, saved-round selection, Studio/SIM returns, final-moves playback ownership and Next-result retirement. Automated suites remain explicitly waived and have not been run for this work.

Production validation and browser observations are not substitutes for physical-device qualification. Remaining release qualification includes supported phone widths/orientations, enlarged text, EN/UK, two-player touch and gamepads, native fullscreen, offline optional packages and flight-specific input devices.
