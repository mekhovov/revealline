# Optional radio View binding

14 October 2026. Adds the missing camera action to the shared radio setup used by World Studio and Academy.

## Player behavior

Radio setup's optional switches section now offers **View** alongside Arm, Pause and Reset. Use the existing learn-a-switch control: begin with the spare switch OFF, move it ON, then return it OFF. The capture rejects flight axes, ambiguous signals and another action's physical-switch alias. A Remove View switch button returns to the menu-only camera fallback. EN/UK instructions explain that View cycles FPV → Chase → Overview after ON then OFF during active flight.

Saved verified calibrations retain the binding and restore through the existing exact-device matching system. Shared setup files include it; imported profiles still require local verification. Radios without spare channels continue to use yaw menu navigation and explicit camera choices in Pause. Standard controllers retain their existing R3 View shortcut; this increment does not add a separate standard-controller remapping editor.

## Compatibility and lifecycle

RadioProfile.v1/v2 validation, serialized content and identity remain unchanged. Only a profile with a View binding is written as RadioProfile.v3, which supports the same axis/button bindings plus camera. Removing View returns to the suitable older format. The v3 profile remains in the existing bounded profile library; older app versions cannot understand a new v3 setup file. The existing untouched legacy storage entry remains available to older versions.

Camera actions require a fresh OFF → ON → OFF in the current active, verified ownership period. Holding a switch cannot repeat the action. Pause, setup, focus-loss freeze, disconnect, profile replacement and reset clear pending camera intent. Both hosts forward an accepted camera action to the same view helper used by pointer/V/R3, retaining its dialog and availability checks. No arming, throttle, attitude commands, response curve, physics, recordings or ghost compatibility rules change.

## Evidence

- All 16 existing `fpv-radio*.test.mjs` checks pass, including setup deselection, library storage, capture and fresh arming.
- Focused temporary runtime exercise passes: v1/v2 identity unchanged; v3 round-trip; axis/button conflict rejection; one action on release; unchanged active flight commands; held switch and focus/menu/setup latch boundaries; disconnect/reverification; library persistence/export.
- Shared setup mounts the View capture/remove row in EN and UK and disposes cleanly in the existing DOM harness.
- Scoped ESLint and whitespace checks pass.
- Source-only change, no assets or new runtime package files. No full frozen-package build performed in this isolated checkout; integrated package/host checks remain publication gates.
- Actual browser/physical-radio acceptance is not claimed by these harness checks. Parent integration should inspect setup in both hosts before publication. No new permanent unit tests added; additional unit coverage remains D6.
