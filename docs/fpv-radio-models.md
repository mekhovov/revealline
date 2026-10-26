# Radio presets and wireless receivers

Research date: 20 October 2026. These presets are starting configurations, not claims of physical testing on every transmitter.

## Player workflow

1. Connect in USB joystick mode, or bind a compatible transmitter to the receiver.
2. The SIM restores the saved calibration and control layout for that exact device first.
3. On a new device, check the suggested model and connection preset. Select the firmware preset explicitly when the device name is ambiguous.
4. Check stick directions and move each proposed switch through its positions. Save the checked configuration. Custom channels can use guided capture or manual setup.
5. Reconnecting restores that configuration without recalibration or automatic arming.

Six roles cover flight and the paused menu:

| Role | Flight | Paused |
| --- | --- | --- |
| Flight | ON: arm/resume; OFF: pause | Resume from the main pause screen after matching the shown stick positions |
| Fire | Fire | Select |
| Weapon | Change weapon | Back |
| Reload | Reload | Change view |
| Payload | Deploy or arm payload | Confirmed retry |
| Detonate | Detonate | Settings |

Paused switches use a deliberate activation and return. Menu navigation uses the self-centering gimbal. Missing combat switches can use **Radio actions** in pause: select an action, resume, release Fire, then activate it once. Release again before ordinary firing.

## Hardware families

The catalogue includes OXBOT R1 and RadioMaster TX15, TX16S, GX12, GX15, Boxer, Pocket, Zorro, TX12, AX12, T8/T8L/T8 Lite/T8 Pro, legacy TX8 and MT12. MAX, Crush, transparent and special editions resolve to their relevant family.

RadioMaster's [controller catalogue](https://radiomasterrc.com/collections/radio-controller) and [manual index](https://radiomasterrc.com/pages/user-manuals) establish the families. The hardware is **not identical**: Pocket has fewer switches; MT12 uses a wheel and trigger and needs a custom four-axis arrangement. A model label does not establish its USB channel assignments.

For Pocket, use its available controls and the paused action fallback; a spare knob can be captured as an additional binary control if desired. For radios with more controls, keep the six principal roles stable and use optional bindings only after capture.

## Direct USB

[EdgeTX's developer guide](https://manual.edgetx.org/edgetx-how-to/joystick-mapping-information-for-game-developers) documents the classic report: eight axes from CH1–8 and buttons from CH9–32. Mixers and advanced USB reporting can change the effective mapping. The SIM's six-role channel convention is a configurable suggestion, not a manufacturer's switch assignment.

OXBOT's [R1 manual](https://oxbot.cn/product/OxbotR1/Oxbot-R1-QSG-cn.html) specifies AETR for its first four channels: roll, pitch, throttle, yaw. It also permits model-specific channel assignment, reversal and endpoint changes. Its previously saved calibration takes precedence over the suggestion.

The existing tested TX15 calibration remains available. The new contextual six-switch layout is a separate preference and does not rewrite historical calibration or replay formats.

## Squid Stick and Pico

The [Squid Stick manufacturer](https://elrsquidstick.com/products/elrs-simulator-dongle-squid-stick) describes an integrated ELRS receiver and RP2040 joystick bridge. A paired transmitter needs compatible ELRS hardware/settings. The receiver's USB identity cannot identify which transmitter is paired.

The [manufacturer-linked firmware](https://github.com/countofkrakow/CRSFJoystick) differs from [upstream CRSFJoystick](https://github.com/mikeneiderhauser/CRSFJoystick). The SIM supplies distinct connection presets:

| Connection | First four stick channels | Suggested six roles |
| --- | --- | --- |
| Squid fork | X, Y, Z, Rx | Flight CH5/button 2; Fire CH6/axis 4; Weapon CH7/axis 5; Reload CH8/button 0; Payload CH9/axis 6; Detonate CH10/axis 7 |
| Upstream CRSFJoystick | X, Y, Rx, Ry | CH5–10 through buttons 0–5; check duplicated axis reports |

These browser axis candidates require checking because operating systems and firmware revisions can expose different orders. The Squid fork reports 24 buttons but drives only four in its published default configuration. Reported button count is therefore not the number of usable switches.

The fork uses the same USB vendor/product IDs as EdgeTX. Generic “Pico” and CRSF names do not prove which mapping is loaded. Choose the connection preset once and save it with the exact receiver identity. Changing paired transmitters with different mixer layouts requires selecting/checking that setup again.

The inspected fork changes its LED on RF link loss but does not expose a dependable radio-link flag in the HID report. The SIM handles USB loss and focus loss; it cannot infer wireless loss from unchanged sticks alone. No receiver firmware is flashed or changed by this feature.

## Persistence and limits

- Saved checked device profiles override built-in suggestions.
- Model/connection choice, calibration and contextual switch layout are independently validated.
- Ambiguous devices remain selectable and configurable; a hardware name never silently verifies unobserved controls.
- Same-browser saved settings are local to that player/browser. No cloud synchronisation is implied.
- Browser file pickers and permission dialogs may require a mouse/touch/keyboard gesture. In-app menus, text editing, numeric editing and supported embedded Studio tools use the radio navigator.
- New presets still need physical-radio qualification. Earlier TX15/OXBOT flight and Fire confirmations do not qualify every new switch assignment.
