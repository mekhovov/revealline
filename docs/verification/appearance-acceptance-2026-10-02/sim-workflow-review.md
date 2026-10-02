# SIM integration and acceptance workflow review

Source: appearance HEAD `ca608cda584a44103284ba20e0a65defe0b53801` plus the pending integration of main `e48adf3185dc7536555d142fe3d1165de31c05f9` and the new authoring workflow. No physical-device qualification is claimed.

## Integrated behavior

- Main's relative touch controls and response settings remain intact. A stale appearance UI test now checks neutral pointer-down followed by relative travel, as required by the merged touch behavior.
- Main's meadow grove placement and courtyard scenery assets remain intact. The appearance material role is retained for grove bark; geometry, simulation, course rules and placement are unchanged by the resolution.
- Main's new Academy/World layout rules sit inside the existing legacy cascade layer; shared theme paint remains above that layer. Shared generated SIM CSS passes its byte-identity check.
- The appearance freeze, recording, sampling and resource-disposal paths remain preserved.

## Reproducible checks

Using Node 20.19.5:

- Exact `package.json` `practice:test`: **224 passed**, [receipt](practice-main961.tap).
- Explicit World runtime/content/appearance UI/editor, workshop visuals, appearance and theme-family controls: **62 passed**, [receipt](world-main961.tap).
- Authoring route/evidence/controller tests plus first-paint bootstrap: **15 passed**, [receipt](sim-acceptance-lifecycle-bootstrap.tap).
- After the browser-discovered material ownership correction, workshop visuals / World runtime / acceptance: **39 passed**, [receipt](sim-instanced-shadow-ownership.tap). The added lifecycle regression checks all eight collections at all three qualities.
- Focused ESLint, formatting and `git diff --check` passed for the new workflow.

The authoring controller tests exercise its actual module with stubbed DOM/renderer boundaries. They check pending/failed source verification, failed scene installation, correct recovery, per-review viewport preservation, cleanup after hashing failure, and disposal while verification is pending. These tests are lifecycle evidence, not WebGL performance or screenshot evidence.

## Independent review corrections

An independent read-only review identified source-verification readiness, failed-scene evidence labeling, and delayed-source disposal gaps. The page now disables interaction until verified installation succeeds, invalidates review/capture/measurement after failed installation, records inspection-time context, preserves each review's viewport, and prevents work from entering a disposed renderer. Measurement cleanup includes its initial hash operation. Snapshot preparation follows quoted CSS imports and rejects computed module imports. The reviewer rechecked these changes and reported no remaining authoring-workflow blocker.

## Browser candidate and qualification boundary

Actual browser testing of candidate-2 found three extra registered materials per themed install. `instanceSimDetails` replaced a registered mesh without transferring its custom shadow-material owners to the instanced replacement. Drone and gate detail batches do not have a later world traversal to recover those owners. The fix retains both custom depth and distance materials on the replacement; shared preview disposal releases them. The new regression verifies every registered material remains reachable and disposes exactly once. Candidate-2 remains diagnostic evidence, not a stable-resource acceptance result.

Immutable snapshot `sim-appearance-acceptance-main961-p1-candidate-3` contains 35 files / 5,552,790 bytes. Its source-manifest SHA-256 is `00f4fc4041c333b1b391f188f2480b36fd5585e67d5d3d3df8a965e3cc101aea`. Earlier candidate snapshots are superseded for qualification. The manifest identifies the exact copied working-tree bytes; HEAD alone does not.

The workflow exposes all 14 environment families and all three quality presets through the real shared renderer, with explicit near/far, grazing, landing, actor and drone views where available. Its ABBA comparison retains raw rAF intervals, separate CPU draw timings, actual browser graphics strings and resource counts. It does not automatically certify readability, flight proofs or physical GPUs. Actual browser captures/timing reports must be retained separately and list their inspected environment/theme/quality scope. Full gameplay fly-throughs, dynamic actor/effect states, front-facing drone review and physical-device qualification remain open.

## Actual browser results for candidate-3

The active in-app Chromium browser ran four complete comparisons at a 1280 × 720 viewport and device-pixel-ratio 2. The reported graphics backend was `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)`; software rendering was not detected. This is a browser-reported device string, not physical-device certification. Each result contains four ordered runs, 60 warm-up frames and 240 measured frames per run, raw CPU draw timings, raw rAF intervals and the exact source/route hashes. The [complete source manifest](sim-candidate3-source-manifest.json) matches every run.

| Environment / course | Quality | Theme/authored p95 ratios, both pairs | Browser frame gate | Registered materials, A → B → B → A | Raw comparison |
| --- | --- | --- | --- | --- | --- |
| Hangar / `flight-03` | Low | 0.9785 / 0.9892 | Pass | 80 → 82 → 82 → 80 | [JSON](sim-candidate3-hangar-low.json) |
| Hangar / `flight-03` | Balanced | 0.9940 / 1.0000 | Pass | 80 → 82 → 82 → 80 | [JSON](sim-candidate3-hangar-balanced.json) |
| Hangar / `flight-03` | High | 1.0122 / 1.0000 | Pass | 86 → 86 → 86 → 86 | [JSON](sim-candidate3-hangar-high.json) |
| Courtyard / `courtyard-01` | High | 1.0000 / 1.0000 | Pass | 138 → 140 → 140 → 138 | [JSON](sim-candidate3-courtyard-high.json) |

A is authored; B is Industrial Workshop. Registered geometry/material/texture counts and renderer geometry/texture counts stayed identical across repeated themed runs and returned exactly on the authored return in all four comparisons. The courtyard run loaded World GLB scenery and reported zero applied theme material bindings with no diagnostics: its unbound authored scenery was preserved. These checks cover the displayed routes and four-run cycles; they are not a long-duration memory soak.

The saved JSON files were read from the completed comparison output in the page. They are not evidence that a browser download was saved and reimported, or that the full export wrapper/manual-review inventory round-tripped. Separate CPU timings are retained; the 10% result above is a browser rAF-cadence gate, not a CPU or GPU cost guarantee. Vsync/adaptive refresh can mask differences, and timings varied across qualities, so these observations must not be generalized to other devices.

Visual inspection found near hangar openings readable, while distant overlapping labels remained faint in both authored and industrial appearances. This does **not** establish complete readability acceptance. The remaining matrix includes other environments, other collections, courtyard low/balanced, all near/far/grazing/actor/landing states, full gameplay routes, repeated-switch soak testing and physical-device measurements. New production model art and further environment asset work are separate from these rendering and lifecycle checks.
