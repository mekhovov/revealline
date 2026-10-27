# Compact flight HUD delivery

> Current consolidated status, remaining gates and estimates: [FPV SIM current plan](../../fpv-sim-current-plan.md). Historical figures below retain their recorded source scope.

20 October 2026. Local implementation in `go_test_radio_fix`. No commit or publication.

## Design and references

The flight view has priority over persistent panels. [VelociDrone’s manual](https://www.velocidrone.com/desktop_manual) documents separate interface, input-visualization and gate-indicator controls, plus selectable OSD layouts. [Betaflight’s setup guide](https://betaflight.com/docs/wiki/getting-started/setup-guide) describes individual instruments and OSD profiles. [Liftoff’s update notes](https://www.liftoff-game.com/news/update-1512-released) describe focused lap-timer feedback and foldout information panels. Those patterns inform the compact default and on-demand detail here; this is an original implementation.

## Delivered

- Shared **Auto / Compact / Detailed** HUD layout for Worlds and Academy. Auto uses the actual flight viewport and switches to Compact at widths up to 900 pixels or heights up to 600 pixels. Resizing and rotation update it without changing flight state.
- Compact combat summary replaces the large multiline status panel. Vitals retain health, weapon, magazine, reserve, payload, reload state and important warnings in a slim strip.
- Compact **Weapons** disclosure retains switching, reload, payload, detonation and service navigation. Actions close it after use; Detailed keeps its full action row available.
- A visible **HUD** button opens the paused widget settings through the existing menu system. No additional radio switches or bindings are required.
- Remembered visibility controls for activity/score, health/ammunition, lesson instruction card, weapon actions, compass, speed/height, passive sticks and drone response. Academy exposes only its applicable widgets. Existing marker, route and optional telemetry controls remain available in the same Flight setup.
- Auto hides passive sticks and the drone-response diagram on compact screens. Explicit On restores them in smaller form, including when the older diagram preference was Off. Actual touch flight sticks are preserved, with smaller controls and labels removed from the flight view. Touch Fire and Pause remain accessible.
- Compact menu branding and camera text leave room for the world. Navigation markers remain separate from the lesson card. Existing radio calibration, physics, scoring and saves are unchanged by these presentation controls.
- Existing combat status/vitals preferences and the older combined instrument preference migrate into the new controls. Changes persist on this device; failed storage still permits session-only changes.

## Browser evidence and scope

Inspected Worlds learning and native combat, plus Academy, in the actual local browser. Captures include 390×844 portrait and 844×390 landscape, with a 1440×900 Detailed inspection. Checked the widget hide/show controls, persisted Off settings after refresh, restoration to On/Auto, compact weapon switching/drawer behavior, Detailed actions staying available, and continued availability of active touch sticks and Fire while passive widgets are hidden.

- [Portrait combat](compact-hud-phone.png)
- [Short landscape combat](compact-hud-landscape.png)
- [Academy portrait](compact-hud-academy.png)

Temporary input, activity and viewport changes were restored. Other-flight activity is Continuous combat, input is Keyboard, HUD layout is Auto, passive widgets use Auto, and the original Worlds tab is left at its home menu. Radio calibration was not edited. The temporary Academy tab was closed. No browser errors were reported in the final Worlds inspection.

Scoped lint, whitespace checks and generated style provenance checks passed. Complete runtime/source candidates were rebuilt under unchanged package policies; see [package receipt](compact-hud-package-measurement.json). No automated test suite was added or run for this HUD-only change. Earlier test receipts describe their recorded revisions and are not presented as results for this update.

Physical-device touch feel, physical-radio operation and broad human readability sessions remain unperformed for this update. Browser size emulation does not qualify those hardware checks.
