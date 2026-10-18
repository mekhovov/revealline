# F09 text and HUD scaling implementation notes

## Measured baseline

Exact runtime: `cb8dddd3d3c11d24c56b014fa48ac0e6417d6465`. Actual desktop browser at1280×720, English, primary Journey shell. Settings changes used normal controls; pause retained the same flight. [Computed measurements](text-scaling-baseline-2026-10-18.json) describe visible Home, Settings and paused HUD surfaces. This is not mobile or200% qualification.

| Surface | Standard | Large | Ratio |
| --- | ---: | ---: | ---: |
| Home Start/Settings/seat label |16px|20px|1.25|
| Settings tabs and selects |16px|20px|1.25|
| Settings title |22px|22px|1.00|
| HUD time/score |26px|30px|1.15|
| Cause message |16px|20px|1.25|
| Pause Resume/Settings |16px|20px|1.25|
| Pause group heading |11px|11px|1.00|

Existing Large remains useful and should keep its present meaning. No current200% in-game option exists. Logo artwork is distinct from text.

## Delivery contract

1. Keep one desired text-size owner. Before exposing an additional size, admit/preserve it through the shared record, legacy-library validation, every host select, generated simulator consumer and non-DOM caption renderer. No separate competing magnification preference.
2. Separate desired size from effective host presentation. Until its layout is qualified, a host must retain the desired choice, visibly explain a Large fallback, and never show a blank select or silently write Standard back. F06 comfort presets continue to select Large.
3. Add the Solo rendering with measured typography, wrapping and scroll access. A200% label requires actual computed-text and usable-layout evidence relative to Standard; do not obtain it by relabeling Large or enlarging only a subset. Preserve ordinary browser zoom.
4. Qualify EN/UK at320,390,1280 widths and handheld landscape; include Home, mission picker, paused flight, settings, critical cause/caption and import/recovery dialogs. Confirm visible controls and reachable scroll content; do not count hidden DOM text as readability proof.
5. Verify record/export compatibility, reload/cross-tab changes, failed persistence and newer intent; settings must leave simulation, replay, current mission, held-input release and caption controls unchanged. Physical devices remain unavailable.

F09a owns compatibility plus shared/Solo delivery; F09b owns each remaining family’s effective layout. Measurement is preparatory evidence, not a shipped feature.

## Current research

[W3C Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text) requires content and functionality to survive resizing up to200%; clipping enlarged controls is a failure. [Xbox text display guidance](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101) recommends scalable game text and accompanying icons. These inform acceptance; this document does not claim certification.

## Compatibility prerequisite delivery

The first F09a PR preserves `extra-large` as desired intent in the existing three-field shared record and library/backup format. `effectiveTextSize` is derived at runtime; every current host renders the established Large presentation. Existing Standard/Large choices and comfort presets keep their meanings. An incoming extra-large value appears as a disabled selected option with an EN/UK fallback explanation, or a read-only explanation where the host has no size control. Opening or relocalizing a screen does not save or reset that intent.

This prerequisite does not expose a selectable additional size, change CSS scale, or qualify 200% text. Solo layout, selection and measured qualification follow in a dependent deliverable; remaining families stay on their explicit fallback until separately qualified. Native decoding, browser history, controls and storage boundaries used in automated host tests are modeled, not physical-device evidence.
