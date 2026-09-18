# Versus fitted-canvas ownership review

Basis: exact source `d34e283819376eb43e4942287d9767b22a4f6487`. Scope is a read-only design review for the unversioned footprint feature. No runtime implementation has been reviewed yet; no tests/browser/build/remotes/source edits were performed.

## Recommended bounded owner

Observe each `.race-arena` **content box**, not its canvas. The arena is the space allocated by the existing seat grid after headings, stats, encounter text and touch controls. For finite positive content width `aw`, height `ah`, and internal board dimensions `bw`, `bh`, compute `scale = min(aw / bw, ah / bh)`, then `width = bw * scale`, `height = bh * scale`. Preserve fractional CSS values and the aspect ratio rather than rounding each dimension independently.

Use this one result for both the canvas CSS box and `BoardPainter`'s existing `displayCSSWidth` argument. Cache it per seat; normal draw calls read the cache. Do not measure canvas/arena layout on every animation frame. Explicit board-geometry changes can recompute from cached arena dimensions without any DOM read.

Prevent a resize feedback loop structurally: the canvas must not determine the observed arena's intrinsic/minimum size. A practical implementation is a stable `position:relative` arena with its fitted canvas positioned and centered inside it. Keep the existing arena's `min-width:0`, `min-height:0` and grid allocation. Observe only the parent, write only the child, and skip equal width/height writes. This avoids an observer loop and ensures a changing bitmap size cannot shrink/grow its own available space.

The centered canvas retains its complete 4:3 or 2:1 geometry. Image fitting inside the bitmap remains owned by the retained presentation binding. Do not crop the map, change its internal canvas dimensions during responsive fitting, or reinterpret intentional image-containment margins as unused layout space.

## Changes covered by parent observation

The existing shell changes board visibility and the `race-focus` body class in `game/couch/couch-shell.mjs:158–172`. It changes each pad's visibility, child controls and seat state in `:174–205`; held controls intentionally remain visible until Pause. Arena observation naturally covers these transitions, native text/font reflow, Standard/Large settings, encounter instructions, orientation and viewport changes. It should not require a new shell input/focus owner or forced pad collapse.

Use `ResizeObserverEntry.contentRect` for the observed content box. It is already expressed in layout CSS units and excludes borders/padding. Avoid using transformed `getBoundingClientRect()` values as inline CSS dimensions; that can double-apply a transform. Prefer explicit zero arena padding if a fallback reads `clientWidth/clientHeight`, because those include padding. Reading a size once at mount/restore or on a resize invalidation is different from forced per-frame measurement.

A feature-detected non-observer path may perform finite event-driven measurement on window resize and explicit layout invalidation. It must state which events it covers; window resize alone does not cover late fonts or pad/text changes. Do not make production throw merely because the finite Node DOM fixture lacks ResizeObserver. Add the missing boundary to the fixture, with an explicit unsupported-API case if the implementation supports one.

## Ownership and lifecycle

- Invalid, nonfinite or zero arena dimensions mean unavailable measurement. Do not divide by zero or publish zero/NaN as if it were a usable visible width. `BoardPainter` ignores zero and falls back to `canvas.clientWidth`, so an invalid measurement must not silently reintroduce the original misleading-width path. Keeping the last valid cached size while hidden is reasonable if it is labelled stale and reconciled on visibility return; no match/art/input mutation is needed.
- A subsequent positive parent-size notification must recover naturally after menus, layout rotation or text changes. Each seat owns its dimensions independently; updating one must not clobber the other.
- Persisted `pagehide` must suspend/cancel pending fitting work without terminal disposal. On `pageshow` or relevant visibility return, acquire a fresh parent measurement or reobserve once. Reconciliation must not call Resume, change simulation ticks, or replace the accepted picture.
- If the observer is disconnected/recreated, guard callbacks with a disposed/suspended flag and an ownership generation so an old queued delivery cannot overwrite restored geometry. Idempotent reobserve/scheduling prevents duplicate observers/one-shot frames.
- Blur alone need not stop harmless geometry work; existing host suspension already owns input and gameplay. Avoid adding a second pause/restart policy merely for sizing.
- Terminal departure disconnects observers, cancels any owned one-shot frame, removes lifecycle/fallback listeners and makes later callbacks no-ops. Repeated disposal is safe.
- Route the owner's disposal through **outer `releaseArtwork()`** (`game/couch/couch.mjs:151–171`) or equivalent startup-failure cleanup as well as normal terminal teardown. The catch at `:1482` invokes that cleanup; it can run before the later main-host `pagehide` handler (`:1300`) has been installed. A new owner installed earlier must not leak on such a failure.

## Minimal DOM compatibility and tests to request

The existing fixture stores inline styles as plain values and supports `setProperty`; it does not calculate CSS. Its arbitrary default element rect is 100×44 and `clientHeight` defaults to 44 (`game/test/helpers/couch-dom.mjs:74–110`). Do not treat those defaults as native arena measurements. The host fixture records RAF callbacks in a finite Map, and its normal BoardPainter spy records draw options rather than drawing (`game/test/helpers/couch-host.mjs:149–180`).

Add a finite ResizeObserver boundary that records observed **arena** targets and accepts explicit content-box deliveries. Assert canvas dimensions and painter width from those deliveries while leaving the misleading canvas client width unchanged. This proves the host passes the right width, instead of teaching the fixture to return the expected answer. A separate real-painter assertion should use the recorded width to verify the actual actor/cut scale.

Request cases for independent seats; legacy/wide geometry; unchanged notifications without redundant writes; touch/text-driven parent changes; zero then positive; stale delivery after cached departure and restoration; terminal departure; and startup failure after owner creation. Verify no per-frame geometry reads or repeated size writes while unchanged. Preserve existing state, artwork-lease and Next/rematch tests. These are modeled contracts, not proof of CSS layout, device rotation or actual visual readability.

## Explicit boundary

This feature corrects fit/width ownership. It does not remove the separate 64-logical-pixel ordinary-enemy cap: a 1152-pixel board fitted to 240 CSS pixels still yields 13.33 CSS pixels of enemy frame. Native review must measure whether supported layouts reach that range, then address space or a separately qualified cosmetic minimum without changing hitboxes. No all-device readability claim follows from fit alone.

## Awaited implementation review

Review the final helper, host hookup and CSS together. Pin their exact bodies and verify that geometry writes cannot alter the observed arena allocation, that stale/terminal callbacks are fenced, and that ready/failed/finished artwork and gameplay ownership remain unchanged. Parent owns implementation and source qualification; the actual-host peer owns its fixtures. This note is guidance, not approval of a still-unwritten candidate.
