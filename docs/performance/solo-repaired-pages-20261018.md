# Repaired Pages verification — 18 October 2026

[Pages run 39102435503](https://github.com/mekhovov/revealline/actions/runs/39102435503) passed build, exact archive acceptance, deployment and public verification for merged main `bbd56e6fcd8f20113ccb168660d5e05d0781e1e3`. Both public identity files independently return that revision and game version 0.151.1. This payload is separate from the [source73 preview package](solo-artifact-73a345cec.md).

The bounded receipt archives were independently downloaded and checked against GitHub's recorded size/digest, ZIP CRC and their source/inventory bindings. The staged inventory contains 3,469 files and 962,565,808 bytes; the accepted uncompressed Pages archive contains 965,580,800 bytes, within the unchanged 980,000,000-byte limit. Full archive bytes were verified by the hosted producer, not downloaded locally. Local receipts are under `.cache/solo-followup/regression-ci-73/pages-bbd/`.

## Public browser observation

The first in-app-browser launch displayed **“Failed to fetch dynamically imported module: …/game/app.mjs”**. Its screenshot is retained. The browser supplied no warning/error console records and no failed-request transcript, so its cause remains unresolved. Do not relabel this first attempt as successful or attribute it to a particular dependency, browser cache or network condition.

One explicit public **Reload game** recovered the Home screen. Continue verified and resumed the existing saved flight. Pause → Settings → Back retained the paused clock at 6:16; explicit Resume, a short native right-arrow input and Escape returned to Pause at 6:20 with three lives. These are UI correctness observations, not measured movement, gamepad, replay, latency, cold-start or sustained-performance results. Sound remained off. The repaired artwork gallery opened, its symbol-layout link opened the mosaic gallery, and the visible first row rendered. No warning/error console entries were reported. The temporary tab was closed; user tabs remained untouched.

An independent bounded HTTP scan then traversed the actual served **static** module graph from `game/app.mjs`: all **578 modules / 7,489,061 decoded bytes** returned JavaScript, parsed and matched the exact staged inventory's byte lengths and SHA-256 values. The scan used six concurrent requests, no retries, 2 MiB per-module/32 MiB aggregate/180-second bounds; it completed in 19.1 seconds. This is a diagnostic network scan, not a browser loading-time measurement. The two public identity files, access gate, new execution-entry helper and both gallery HTML files also matched that inventory. An earlier guessed `/game/ui/execution-entry.mjs` probe returned 404; it is not an imported path. The actual `/game/content-design/execution-entry.mjs` returned 200 and matched. Likewise the guessed UI gallery-difficulty path was not part of the checked module graph.

This readback rules out a currently missing or mismatched module in the checked static graph. It does not reconstruct the original failed request, test later dynamic imports or establish universal launch reliability. Keep the failure open for a reproducible network trace. The graph size also merits a narrow review of optional modules still loaded at startup; byte counts alone do not establish a gameplay stall.

## Remaining priority

The runtime repair is published. Finish the testing-runner cleanup correction and source73 native admission, then observe final-package correctness, loading/touch/raster, repeated transitions, matched timing and sustained play. Preserve prior failed observations. The soundtrack publication approval and unavailable physical devices remain separate open requirements in the [living plan](solo-performance-followup-plan.md).
