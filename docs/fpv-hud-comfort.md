# Flight comfort and compatible personal-best access

14 October 2026. P2 stick presentation and P3 camera comfort increment; presentation-only.

## Completed implementation

Both Academy and Worlds share a Stick appearance group in Accessibility. Auto retains existing device-aware layouts; Compact and Large explicitly size live monitors. Touch controls remain at least 88 × 88 CSS px even with Compact selected, and explicit sizes are bounded to the viewport. Quiet, Balanced and Strong adjust visual opacity without changing hit areas. Existing stick visibility, assistance and HUD settings remain authoritative; Pause and objective guidance are untouched. The shared preferences persist locally across the two hosts.

Display offers explicit Learning (82° FOV / 0° tilt), All-round (95° / 15°), and Racing (110° / 25°) camera presets. Existing sliders remain available for custom values. Presets dispatch the same canonical input/change events and are disabled during unpaused play. Values persist separately per host. They never change flight mode, response, input, arming, score or proof identity. Course recommendations remain free to change their documented camera view; there is no per-frame reapplication of a preset.

Worlds Pause now exposes the existing personal-best summary and ghost button together. This delegates to the established verified compatible-recording lookup, cancellation, errors and availability. No best is invented for a different course, revision or flight configuration. Academy has no matching best-flight mechanism, so it receives camera/stick preferences without an artificial ghost feature.

All new text is EN/UK. The settings use native selects and buttons, allowing the established keyboard, controller, D-pad and calibrated-radio menu navigation to own interaction. Repeated refreshes cache their rendered signature; no layout reads, physics updates, additional animation or new package files are introduced.

## Verification completed

- 123 existing radio/control/shared-shell/flight/appearance checks passed. Log: `/tmp/fpv-hud-existing-checks.log`.
- Focused in-memory DOM exercise passed: preference persistence, EN/UK labels, camera event forwarding, rejecting active-flight changes, canonical ghost action/disabled state and disposal.
- Scoped ESLint and JavaScript syntax checks passed.
- Shared shell and presentation projections are byte-identical to their canonical source; diff whitespace check passed.

## Still to verify before release

Integrated browser checks cover desktop, 390 × 844, 844 × 390 and Academy 1280 × 800 with no measured horizontal overflow, Large/Quiet touch controls, paused All-round preset selection, preference restoration across both hosts, the unavailable ghost state and EN/UK. Existing compatible-best lookup remains authoritative; a new physical-device or available-ghost flight is not claimed. Physical iPhone, Steam Deck and radio qualification is not claimed. Full frozen package admission and publication remain independent release gates; no new unit coverage is claimed (D6 remains deferred).

Interaction review additionally checked asynchronous personal-best updates while a controller is editing the camera select. Pending selections and focused nodes are retained; unchanged labels do not replace their text nodes. A preset sets both FOV and tilt before either canonical change event, so observers never see a partly applied preset. The focused DOM exercise passes these cases and restores a rejected active-flight selection to the real camera values.
