# Guided radio setup and immersive flight

The old setup exposed channel numbers, endpoint fields, switch bindings, rates
and profile JSON at once. Its styles also targeted only the original simulator's
container, leaving World Studio with an inconsistent, difficult-to-use form.

The shared screen now opens a verified radio directly on a live stick check.
Players confirm the displayed directions and choose **Save & return**. The host
selects USB radio and returns to the paused flight, preserving same-flight pickup.
Setup never arms the drone.

New radios use **Connect → Calibrate → Check & save**. The guide asks for one
direction and endpoint at a time, detects the channel and inversion, measures
centres, and distinguishes a non-centring radio throttle from a spring-centred
gamepad. It rejects ambiguous movements and insufficient travel. Back and Cancel
preserve draft or prior calibration; the guide writes storage only on an explicit save.
Connection changes interrupt capture instead of mixing device samples. Compatible
switch bindings survive recalibration; any binding that conflicts with a newly
mapped stick is cleared with an explanation.
Starting the guide stops unfinished advanced capture operations, so they cannot
overwrite guided measurements or prevent saving the completed calibration.

Raw channels, numeric calibration, optional switches, response curves and profile
backup remain available in separate expandable sections. Both simulators use the
same responsive layout and EN/UK copy. A denied storage write is reported explicitly
and still permits using the verified mapping for the current session.

Every World Studio flight entry point and original Academy level now has a
**Fullscreen** control. Native fullscreen includes the document's dialogs; if the
browser denies or does not support it, the simulator fills its available window.
HUD, live sticks and essential controls remain accessible. Settings can be expanded
without leaving the view. Escape and native fullscreen exit pause the flight and
never automatically resume or fire.

## References and decisions

- [VelociDrone's Input / Setup Sticks guide](https://www.velocidrone.com/mobile_manual)
  separates device detection, directed calibration and raw diagnostics. The new
  flow follows that division while retaining a shorter path for known radios.
- [Liftoff controller support](https://www.liftoff-game.com/support?category=1&post=44&topic=3)
  describes defaults for recognized controllers and setup for other devices.
  Exact verified device matching remains the foundation here.
- [EdgeTX stick calibration](https://manual.edgetx.org/color-radios/radio-settings/hardware)
  recommends normal endpoint pressure and straight movements. The guide therefore
  asks for one direction at a time instead of asking players to spin both sticks.
- [MDN Fullscreen guide](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide)
  documents user-activated requests, failure and change events. The implementation
  handles each and preserves an explicit exit in the window fallback.

Functional receipts and exact build identities are in
`fpv-radio-setup-ux-verification.json`. New unit coverage remains in final
qualification. Browser verification, build limits, input/replay behavior and
physical player feedback continue during feature delivery.
