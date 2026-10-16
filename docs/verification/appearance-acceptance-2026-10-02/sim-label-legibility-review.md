# SIM objective-label legibility

This is a shared renderer cue-layout/contrast correction. No collection, model, material or asset revision document changes. Authored/legacy profiles that do not resolve to a compatible SIM collection keep the existing label texture, sizing and opacity path. The change applies to objective badges for compatible SIM visual collections, including course-authored or replay-pinned collections; simulation, camera rules, target coordinates and proof data are untouched. Selecting Authored for the default Hangar still uses its unchanged original profile.

## Cause and correction

The old 0.72-world-unit badge projects to about 10.35 CSS pixels at the acceptance route's 24 m distance, 82° vertical field of view and 600-pixel canvas height. Two-digit text occupies only part of that badge. The fixed pale text also failed on light collection panels.

Selected collection objective badges now pair text with their opaque panel color, use a stronger glyph, and enlarge only the active badge toward 18 CSS pixels using the actual camera projection and CSS viewport height. The size never exceeds twice its original world-space width. Adjusting the sprite center preserves its original lower edge above the opening without moving the sprite or target. Near views retain the original world size; inactive labels retain the original size and 0.35 opacity. Invalid, zero or nonfinite viewport/projection inputs fall back to the original bounds.

Depth testing remains enabled and depth writing remains disabled, as before. There is no through-wall mode, render-order override, new target visibility, distance-independent unlimited sizing or collision geometry. Existing actor-goal visibility checks remain in force. The 18-pixel target is deliberately subordinate to the world-size cap.

| Collection          | Panel     | Old text contrast | New text contrast |
| ------------------- | --------- | ----------------- | ----------------- |
| Industrial Workshop | `#465052` | 7.69:1            | 7.69:1            |
| Dnipro Porcelain    | `#dfebf1` | 1.13:1            | 14.73:1           |
| Windows Classic     | `#b9bfc5` | 1.72:1            | 9.65:1            |
| Orchard Workshop    | `#af996e` | 2.56:1            | 6.48:1            |

All eight admitted collections meet at least 4.5:1 for the opaque active label's foreground/background pair. These ratios describe the painted pair, not partially transparent inactive labels or a full rendered-frame contrast audit.

## Checks and source identity

- New projection and renderer-path regression tests cover current-camera projection, fixed lower edge, the world-size cap, near/far switching, Dnipro contrast, inactive hierarchy, invalid input fallback, explicit depth behavior, unchanged target coordinates and the authored path.
- Focused label/workshop/World runtime/appearance/acceptance suites: **57/57 passed**, [receipt](sim-label-legibility-focused.tap).
- ESLint, formatting and diff checks passed for the changed files.
- Independent read-only review found no blocker. It confirmed bounds, visibility, depth behavior and unchanged material ownership.

The tests exercise real Three.js scene/camera/sprite calculations and the actual renderer module with a stubbed WebGL boundary. They do not establish GPU rendering, occlusion pixels or physical-device readability.

Snapshot: `sim-appearance-acceptance-legibility-candidate-1`, 35 files / 5,583,164 bytes. [Source manifest](sim-legibility-candidate1-source-manifest.json) SHA-256: `84bdb5c902c0bbce576df433b0b4151ed0ffa84b918a9e551ada65ad9528879c`. It was prepared from HEAD `a4b7c9d64e2253da06f00f205559063563b5047a` plus the recorded working-tree edits. The prior candidate-3 fixture is available for visual comparison; the two manifests distinguish their source bytes.

## Actual browser inspection

Candidate-1 was inspected in the active in-app browser at 1280 × 720, Balanced quality, Training Hangar (`flight-03`). The active `02` glyph was readable in both near and far views for Industrial Workshop and Dnipro Porcelain, and the enlarged badge stayed above the clear gate opening.

| Collection          | Near                                                                              | Far                                                                              |
| ------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Industrial Workshop | [Capture](../appearance-continuation-2026-10-02/sim-industrial-near-balanced.png) | [Capture](../appearance-continuation-2026-10-02/sim-industrial-far-balanced.png) |
| Dnipro Porcelain    | [Capture](../appearance-continuation-2026-10-02/sim-dnipro-near-balanced.png)     | [Capture](../appearance-continuation-2026-10-02/sim-dnipro-far-balanced.png)     |

The [Authored far capture](../appearance-continuation-2026-10-02/sim-authored-far-balanced.png) records the retained original path. These are review observations and saved captures, not a claim that the fixture's manual-review form/export wrapper was submitted and reimported.

Dnipro's distant gate outline remains faint. This change improves badges; it does not close the overall cue-readability gate. Other cues, environment/collection states, quality presets, pixel-level occlusion cases, full gameplay routes and physical-device readability still require review.

An initial ABBA run showed stable repeated GPU geometry/texture counts (Industrial 126/21; Authored 120/23), but its timing overlapped a focused test run and is excluded as performance acceptance evidence. The subsequent [idle comparison](../appearance-continuation-2026-10-02/sim-balanced-frame-review.json) passed both browser-frame pairs: themed p95 9.1 ms versus authored 9.2/8.9 ms (ratios 0.989 and 1.022). Repeated collection resource counts matched exactly. Auxiliary GLB/media tabs were closed and the local test workload had finished. This is browser cadence on the reported Apple M4 Pro/ANGLE backend, not GPU timestamp measurement or physical-device qualification. Historical candidate-3 timing does not qualify these newer source bytes.
