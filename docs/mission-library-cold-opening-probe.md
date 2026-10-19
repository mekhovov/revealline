# Investigating a cold Mission Library opening

Run the explicit diagnostic with:

```sh
npm run test:mission-library-solo-cold-opening-diagnostic
```

The complete one-case probe installs the existing night-shift test pack, opens the Legacy Home screen and activates the real Browse control. It uses the existing 15-second chooser predicate. The `.probe.mjs` filename keeps this opt-in experiment outside ordinary game-test discovery; its focused CI command runs it explicitly. Existing library cases and their commands remain unchanged.

The public `?performance=1` option already emits `RevealLineMissionsStageV1` messages for imports, data, sources, installed content and chooser construction. The probe forwards those messages unchanged and retains up to 64 lines, 512 UTF-8 bytes per line and 8,192 bytes total, with dropped/error counters. A failure appends JSON bounded to 12,288 encoded bytes. Inspect the last emitted stage and retain the full output, exact revision, runtime, complete TAP totals and command exit. A missing final marker alone does not identify rejection or cancellation.

The fixture legitimately writes its installed pack to a test IndexedDB store. Capturing logs adds no storage operation, clock, frame, retry, opening gate or cancellation. The existing performance option and console capture add work and can change scheduling: an instrumented pass does not qualify the ordinary path or resolve its earlier failure. A fresh test-file realm also does not establish cold device, disk or operating-system caches.

Source review, syntax, formatting and read-only evaluation of the exact current focused planner were completed before publication. Native probe execution, ordinary-path repair, package and physical-device acceptance require separate evidence. Original diagnostic #1757 retains its exact-source 18/22 result.
