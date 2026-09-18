# P08-A Versus board footprint proposal

Status: generation 2 local source verification and independent review complete; unversioned proposal ready for coordinator integration. No release acceptance is claimed.

Base: `d34e283819376eb43e4942287d9767b22a4f6487`. Worktree: `.cache/worktrees/p08-versus-footprint`, branch `codex/p08-versus-footprint`. The package, lockfile and build version remain 0.61.5. Nothing is staged or committed; no remote, release, asset-producer or browser actions belong to this proposal.

## Change and reason

Both Versus canvases now fit their complete logical board into the arena content box and pass the fitted CSS width to the existing BoardPainter. Previously `object-fit: contain` preserved the picture ratio inside a larger element, while actor scaling read that larger element width. The geometry, accepted original, artwork fit, collision, input and simulation owners remain unchanged.

The canvas is an absolutely positioned child, so its bitmap dimensions cannot enlarge the grid slot. One ResizeObserver owns both arena content boxes, numeric equality suppresses redundant style writes, and zero/hidden bounds do not become a valid painter scale. Restoration recreates the observer and measures again; obsolete callbacks and terminal departure cannot revive layout work or resume a match.

Generation 2 adds a narrowly targeted fallback: without a live ResizeObserver, encounter visibility/title/instruction changes join the layout key. Both HUD cues update before measurement and either board draw. Unchanged keys do not read geometry. Observer-capable hosts keep cue reflow on the observer path; they do not measure every encounter timer change.

## Reproduction and evidence

Final generation 2 cohorts: **353/353 on Node 20.19.5 and 22.22.2**, 23 files, zero failures/skips/cancellations. All 344 hydrated source inputs stayed unchanged. Elapsed time: 310.69s / 287.78s respectively. These are scoped source regressions, not the whole release gate suite.

- `source.patch`: 41,240 bytes; SHA-256 `7717a9abf68cf18bd1f80c0dacd0e82d196ecd7c345a4beb5db73e8ea96113d1`. Eight paths, recorded in `source-manifest.json`; reverse application check passes.
- `fit-review/generation2-correction-review.json`: independent source/host-test review PASS; SHA-256 `31ce815b3aa1a6da295013c60293b547176547644cc72a83715750cf97796526`. Original generation 1 reviews remain unchanged.
- `preservation.json`: ten important existing files equal the exact base, including renderer, actor construction, inputs, picture owners, simulation, compiled runtime and all three version files. The cached diff is empty.
- `host-tests/completion-fallback.json`: 5/5 real-host tests pass on Node 20.19.5 and 22.22.2; focused fallback also passes on Node 20. The fallback uses the real sentinel campaign, normal host ticks to 241 and real encounterView/BoardPainter. Finite DOM geometry follows the actual warning cue: widths change from 400/400 to 300/312 before the same frame paints either seat. Runs and accepted pictures stay identical. Zero-time unchanged frames perform no geometry reads.
- `correction/unit-node20.json` and `unit-node22.json`: 6/6 geometry/lifetime tests on both Node families, including fractional CSS serialization and live/suspended/restored/disposed observer state.
- `correction/lint.json`, `format.json`, `whitespace.json`, `index.json`: affected-source lint, eight-file formatting, whitespace and empty-index checks pass.
- `generation1/`: preserved original proposal, reviews and both 352/352 cohort passes. These original passes do not cover the later fallback correction.
- `host-tests/fallback-red-node20.json`: original legal-tick stale-width failure before the correction; retained test adapter and exact runtime pins. Other original RED/GREEN logs remain in `host-tests/`.
- `initial-sparse/`: first cohort failure caused by absent exact-source dynamic fixtures. `missing-input-review/` and `reviewed-fixture-admission.json` document the bounded fixture closure; unchanged source art was hydrated, not produced or modified.
- `bounded-sequential/`: the subsequent single-worker Node 20 run reached its 300-second limit without a reported test failure. It is incomplete evidence, not a pass; later cohorts use two workers and a 600-second bound.

The regression command is recorded in each cohort receipt and reproducible via `qualify.py 20 2` / `qualify.py 22 2`, using the 23-file list in `cohort-paths.json`. It captures every hydrated source input before/after execution. Exact existing output names must be preserved before another run.

## Limits and next release qualification

DOM layout, Image decode and Canvas2D calls in the source tests are modeled boundaries; the actual host, painter, cue model and simulation are exercised. This is not native visual, physical-controller, touch-device, performance, offline, complete six-gate or public-play evidence. The sole release coordinator owns integration, version allocation, full gates, immutable freeze, publication and browser qualification.

This change fixes the scale handoff; it does not increase the existing 64-logical-pixel enemy cap. On a 240-CSS-pixel-wide 72-column board (1152 logical pixels), that cap is 13.33 CSS pixels, below the separate 16-pixel phone goal. That follow-on remains P08-A. The arena container may still have intentional gutters around the contained board. Team Large-text cues and Motion Lab focus after rotation remain separate P05/P03 work.

Native follow-up must inspect both seats with 4:3 and 2:1 boards, touch-pad visibility, Standard/Large text, portrait/short landscape/handheld viewports, actual encounter cue wrapping, pause and explicit Resume, cached-page restore, and terminal departure. Check both accepted artwork and actor/cut readability without stretching/cropping gameplay. No pass here qualifies all maps, installed/custom content, input devices or a whole phase.

The layout rationale follows [MDN object-fit](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit): contain preserves content proportions within the element and can leave unused space. The guide and runtime-maintainer skill contain the implemented two-seat maintenance prompt and explicit cap limitation.

Delivery order supplied by the coordinator remains P03 → P05 → P08-A → P08-B → P09 → P07, followed by the separately tracked remaining phases. This proposal does not authorize another implementation ahead of that queue.
