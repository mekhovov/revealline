# SIM appearance acceptance

This authoring workflow compares an original course's authored appearance with a selected visual collection using the shared Academy/World renderer. It includes current built-in World GLB scenery where supported, preserves unbound imported materials, and never runs flight commands, changes a course, saves player preferences, or earns progress.

## Prepare an immutable source snapshot

Run `node scripts/prepare-sim-appearance-acceptance.mjs --name UNIQUE-NAME`, then serve the repository locally and open the returned `dist/sim-appearance-acceptance-UNIQUE-NAME/authoring/fpv-worlds/acceptance.html` path. `--verify-only` checks the bounded dependency closure without writing files. Existing snapshot directories are never overwritten.

The preparation tool copies only the local module/style/font closure (at most 128 files, 6 MiB per file and 32 MiB total). Literal module imports, stylesheet URLs and quoted CSS imports are followed; computed imports and external or escaping paths are rejected. It records the Git revision, whether selected sources contain working-tree changes, and each copied file's SHA-256. The browser verifies every file before enabling inspection. Evidence records the complete manifest hash; a Git revision alone does not identify uncommitted source bytes. These limits belong to the authoring fixture and do not change Academy, World or edition package limits.

## Review the view matrix

Select the environment, collection, and low/balanced/high quality. Current coverage includes all 14 environment families: the original eight plus six adventures. Each route selects a real gate-bearing course when available and otherwise clearly reports objective-volume coverage. Its fixed near/far, grazing floor, oblique landing, actor (when present), and drone chase views use deterministic positions and lenses. The scene remains unmodified; these are synthetic camera fixtures, not successful simulation flights.

For each applicable view:

1. Compare **Show authored** and **Show theme** with the same quality and view.
2. Check gate openings and target silhouettes; landing lines and marks; drone rear/side direction; distant details and grazing surfaces. Save a PNG when it explains a defect.
3. Record **Readable** or **Needs work** and a useful note. Only that exact environment, appearance, quality and view is covered by the judgment, with its own device and viewport record. Nothing is marked readable automatically. Failed scene preparation disables review, capture and measurement until a scene loads successfully.

Front-facing drone checks remain in `authoring/fpv-worlds/calibration.html`, which uses the same model factory. Actor states absent from the selected course, dynamic effects, occlusion, all physical devices, and full gameplay fly-throughs need separate coverage. The workflow reports these limitations in exported evidence.

## Measure paired frame times

Keep the tab focused and visible, its window size unchanged, and other graphics workloads idle. Select **Compare current quality**. The route runs in authored → theme → theme → authored order, each with shader preparation, 60 warm-up frames, and 240 measured frames. The two opposite-order pairs reduce order bias and must each stay within the planned 10% p95 margin to pass the **browser frame** check. Run all three quality presets on the same device and repeat unexpected regressions before attributing them to a theme.

The report separates CPU draw/submission timing from complete `requestAnimationFrame` intervals, retaining raw samples, viewport/backing dimensions, device pixel ratio, browser-reported graphics device/software flags, and resource counts after each switch. It cancels incomplete, hidden, unfocused, resized or lost-context measurements. Cancellation never produces a passing comparison.

Vsync can hide GPU cost, and browser graphics strings cannot establish physical-device qualification. A passing browser result therefore always retains `physicalDeviceQualified: false` and `gpuTimestampMeasurement: false`. CPU-only unit tests verify route determinism and evidence rules; they do not prove visual quality or frame performance. Existing proof/determinism tests remain independent.

Use **Export evidence JSON** after review and measurement. Keep the source manifest, screenshots, raw results and review notes together. The current page retains judgments only in memory; export before closing. No evidence is published or uploaded automatically.
