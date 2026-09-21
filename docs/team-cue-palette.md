# Team semantic cue palette

Prepared Team presentations derive functional cue colours from the accepted canvas palette. Warnings use accent, recovery/captured/slowed states use safe, threats use danger, quiet enemies use muted, and labels use ink on opaque paper plates. Values below unrounded 4.5:1 against paper receive a black/white legibility fallback. This does not change the selected collection, artwork revision or content identity. Explicit null presentation keeps the historical drawing path.

Paper-relative contrast is insufficient for paths painted directly over black concealment or revealed artwork. Support radii, recovery/slowed rings, spawn landmarks, core hexagons, warning paths/targets and actor outlines use opaque two-tone strokes. Their inner width is at least 1.5 CSS pixels and the outer stroke adds 2 CSS pixels. The painter restores prior line width and alpha. The true-radius cutting head is filled again after its halo; otherwise the responsive outline can erase its colour on a small board. Existing shared trails retain their dark outline, player accent and light core. Geometry, labels, player numbers/shapes, simulation and timing remain unchanged.

The functional text check uses [W3C text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Board paths account for [adjacent-background contrast and thin-stroke limitations](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). These bounded checks do not claim whole-game accessibility certification. A poorly chosen theme is not made production-ready merely by fallback colours.

## Verification

The targeted six-module cohort passes 98/98 on Node 20.19.5 and 22.22.2. Tests cover dark/light/all-gray palettes at canvas widths 320, 390, 568 and 1152; opaque backing, two-tone paths against black/white/gray, final head paint order, unchanged geometry/run state, exact legacy restoration, clean victory artwork and 600 matching simulation ticks in each arena. Public-command-earned preview fixtures are distinct from synthetic edge-case contrast states.

Local native Studio review uses exact source 6c51b7e9 plus this candidate. Existing shared sprites and the reviewed picture are decoded through the real preview. Through normal controls, stage gray and light tokens and inspect Relay Yard warning, recovered-player and capture states. At 390×844 and 320×844 viewports, Studio canvases measured 308×154 and 238×119; these are authoring previews, not full live-game layout qualification. Functional markers remain visible; no JavaScript errors were observed. Low-contrast cues, head paint order and mock canvas alpha defaults were corrected during review before final tests.

Support/slowed edge states are covered by command tests; native review observes slowed states in capture feedback. Full live-game Support/emitter scenarios, both arenas across physical devices, performance, six release gates on integrated committed source and public/offline acceptance remain required. This feature does not close P08-A or the complete theme benchmark.

## Authoring prompt

> Use the accepted Team presentation to review functional cue contrast. Preserve original picture identity, black concealment, clean victory art, exact simulation, labels and player number/shape identity. Check warning targets, Support, recovery, slowed, spawn, anchors, core and final heads over light/dark art at actual phone sizes. Test an all-gray palette as an adversarial case. Keep opaque contrasting edges around paths and text on paper plates. Refill the true-radius head after outlines. Report modeled canvas assertions, decoded native previews, physical inputs and public release evidence separately.
