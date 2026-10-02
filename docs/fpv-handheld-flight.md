# FPV handheld flight and standard controllers

## Player changes

Academy and World Studio use a full-height flight viewport on phones and handheld
screens. Touch sticks stay at the lower corners; the title, next objective and
essential instruments stay at the edges. Briefings, source/camera/quality choices,
recordings and other details move into an explicit paused Menu. Opening the menu
pauses physics and clears input. Back to flight closes the menu without arming.
The learning guide, optional drone schematic, results and touch combat action
remain available. Controls respect dynamic viewport height and safe-area insets.
The browser and app-style layout use the same rules; native fullscreen remains an
optional enhancement. Fresh coarse-pointer sessions start with touch controls.

Both hosts accept browser-standard controllers, including Steam Input's Gamepad
layout. A/Cross arms or resumes after a neutral, released pickup; Y/Triangle resets;
Menu/Start or B/Circle pauses. Left horizontal controls yaw; left vertical changes
throttle, which holds when centred. Right stick controls roll/pitch. D-pad supplies
roll/pitch, LB/RB yaw, LT/RT throttle adjustment and X/Square fires in World combat.
Menu navigation retains its separate input ownership. A calibrated radio's slot
is excluded from this adapter. Unsupported mouse/keyboard Steam Input layouts
must be changed to a Gamepad layout; product identity strings are not required.

The unscored learning lab also accepts intentional controller takeover from an
example, retaining the example's current thrust. Practice remains indefinite.
Controller sampling integrates throttle only at the existing 50 Hz physics tick.
Pauses, resets, focus loss, replacement and disconnect clear actions and require
fresh neutral pickup. The UI Arm button checks current neutral controls, not only
whether the controller was neutral earlier. The first stick movement after an
accepted Arm is retained. An unused controller disconnect cannot interrupt a
keyboard/touch preview.

## Design references

[Apple's game touch-control guidance](https://developer.apple.com/videos/play/wwdc2026/358/)
and [layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout)
informed reachable edge controls, safe areas and reduced obstruction of play.
[Valve's compatibility guidance](https://partner.steamgames.com/doc/steamhardware/compat)
informed the 1280×800 check, readable essential text and complete controller actions.
[Steam Input emulation guidance](https://partner.steamgames.com/doc/features/steam_controller/steam_input_gamepad_emulation_bestpractices)
and the [W3C standard gamepad mapping](https://www.w3.org/TR/gamepad/#remapping)
informed device-independent axis/button handling. The exact placement, 44 px
interaction targets and throttle-rate choice are project decisions.

## Verification and remaining qualification

Actual-browser fixtures load production HTML, renderers and fixed-step physics
with disposable preferences. Evidence is stored under `docs/evidence/`:

- 96 layout checks across both hosts at 390×844, 844×390 and 1280×800, including
  EN/UK, coarse-pointer/standalone feature queries, clear central flight area,
  menu access and closing the menu without arming.
- 24 real-host controller checks: held-button connection, explicit Arm, immediate
  post-Arm input, throttle hold, all axes, D-pad/shoulder/trigger fallback, menus,
  reset, disconnect/reconnect, blur/focus, UI neutral guard and keyboard pause.
- 18 adapter checks and 13 lesson-preview checks, including indefinite practice,
  exact input display, radio exclusion and ownership transitions.

Viewport/media queries and controller samples are controlled for repeatability.
These receipts do not qualify physical iPhone Safari/WKWebView, Steam Deck,
TX15/Xbox/DualSense hardware, real touch ergonomics or sustained performance.
Additional unit coverage remains in R7. No physics, scoring, replay identities,
package limits or asset licenses are changed. Public release still requires
protected PR checks, merge, deployment identity verification and a public launch.
