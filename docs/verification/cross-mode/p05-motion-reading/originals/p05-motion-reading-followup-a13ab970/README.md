# Motion follow-up: readable labels and still-background contract

17 September 2026. **Scoped modeled candidate; not native, released or full-phase acceptance.** This incremental [patch](candidate.patch) applies **after** the frozen [Motion startup/reading packet](../p05-motion-successor-a13ab970/README.md), whose patch SHA-256 is `dcc5a496b374ac4c0d675cae33e4683aa3ee38b036f3fcf55d606b7395889c79`. That parent remains unchanged. Both use exact source `a13ab970222498d7c5fa7f62f9fc04fe436979d5`, tree `cf744b1ced9680b2fb4e0c304ddfc4b9f44b3e86`. The Motion/shared paths have no differences at the merged source `d3a7d5c7`.

The release owner allocated only the two documented Motion follow-ups. No active source worktree, index, version, remote, browser, Recovery, build snapshot or public release was changed. Version remains 0.60.3; adoption and the next unused release version belong to the owner after its current release cycle.

## Changes

**Long labels.** Canvas captions retain the existing 14px Standard / 18px Large minimum. Measured ink is kept within the fixed 48×36 stage on both axes; long captions use grapheme-safe ellipsis. An impossible caption is omitted rather than compressed below the minimum. The DOM Stage labels section supplies full permitted text in the existing settings scroller, with wrapping and stable rows. It adds no modal, tooltip, input action or live announcement stream.

A shared presentation descriptor feeds canvas and DOM. Concealed notes expose only `?` / “Concealed note”; revealed text expires during the corresponding render, not the slower status update. Disabling the toy study hides and clears its legend. Full authored target names, readiness/outcome and current note visibility remain separate. Preferences do not steal focus, reset the study or replace its frame.

The painter caches only bounded grapheme boundaries (128 entries; labels up to 2,048 UTF-16 units), never font metrics. It remeasures current fonts on every paint. If `Intl.Segmenter` is unavailable, whole text or a single ellipsis is used without splitting a grapheme. Source coordinates, presets, original images, geometry/effects and simulation remain unchanged. The new helper is added to the existing public build include list.

**Background contract.** Research did not establish an animation bug. Canvas is specified to draw an animated image element's default image, or its first frame if no default exists. The separate [background conformance packet](../p05-motion-background-conformance-a13ab970/README.md) supplies five synthetic fixtures totaling **878 bytes**: static control, animated GIF, APNG with a separate default, animated WebP, and an invalid PNG. Their hashes, decoded metadata and native steps are prepared; native behavior remains unexecuted. Its additive README/skill text is incorporated here; no rendering/decoding API or accepted format was changed. Do not also apply that packet's documentation patch after this one.

The Motion guide, Animation Director skill and runtime-maintainer skill include updated implementation prompts and evidence boundaries.

## Qualification

| Check | Result | Evidence |
| --- | --- | --- |
| Node 20.19.5 | **160/160** across 14 complete files; 1024 MiB, concurrency 1, no timeout | [receipt](runs/node20-final/receipt.json), [log](runs/node20-final/output.log), [inputs](runs/node20-final/inputs.json) |
| Node 22.22.2 | **160/160**, identical 83 inputs; no timeout | [receipt](runs/node22-final/receipt.json), [log](runs/node22-final/output.log), [inputs](runs/node22-final/inputs.json) |
| Scoped source checks | Explicit changed-path format, changed game-module lint and JavaScript syntax pass | [record](runs/scoped-source-checks.json) |
| Patch reproduction | 13 changed paths; exact parent preimages; temporary application reproduced each candidate byte | [pins](candidate-pins.json) |
| Bounded inputs | 83 files / 1,751,404 bytes; 70 unchanged parent inputs | [final inputs](runs/node22-final/inputs.json) |

The cohort includes all six Motion algorithm/steering files, complete direct-tool loading/launcher and shared-preference files, 24 real-application host cases, seven display-restoration cases, two frame-loop cases, 12 label-helper cases and three renderer cases. No name filtering or broad source/build test run was used.

New cases cover English/Ukrainian strings, combining accents and apostrophes, long unbroken text, exact fit, ink overhang, edges and lower pads, tiny/invalid scale, font metric changes, bounded segmentation, concealed→revealed→expired notes, no state mutation, real full DOM text, preference/focus/frame preservation and ability hide/show. Geometry assertions use modeled text metrics. They do not prove actual glyph rasterization or layout.

**Retained correction:** the [first run](runs/node22-first/output.log) passed 159/160. Its host expiry case assumed 125ms elapsed yielded exactly 0.125 authoritative seconds; the unchanged 120Hz simulation accumulated a value just short of expiry. The host step now crosses that boundary at 134ms while still only 34ms after the general readout. Exact equality remains a separate descriptor test. The [original host source](runs/node22-first/host-before-timing-correction.mjs), [pins](runs/node22-first/inputs.json) and [correction record](runs/node22-first/correction.json) remain. No simulation or runtime correction was made to force the assertion. A [corrected precursor](runs/node22-corrected/receipt.json) and both final runs pass.

## Remaining acceptance

- Review/apply parent then this incremental patch on the latest source; reconcile shared copy/build/skill hunks. Run the full six source gates, ordinary build, production/readiness and artifact checks, then synchronized unused version, commit and immutable public release workflow.
- Native fonts and font readiness, real ink bounds/overlap, narrow settings scrolling, Standard/Large, Theme/Plain and 200% zoom. The Stage labels section is not a complete nonvisual game interface or a physical-device acceptance claim.
- Execute the per-format background conformance protocol through the actual UI. Pixel comparisons must account for opacity, terrain and overlays. Preserve APNG's distinct default image; do not confuse animated viewer playback with canvas behavior.
- Real startup/focus/history, BFCache versus recreated document, supported physical inputs, performance, public play/offline and published bytes remain owner work. The previous Motion packet's other native gates are unchanged.

Canvas `fillText` maximum-width fitting may condense glyphs or lower font size, so this correction uses an ellipsis with unchanged size. [MDN fillText](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText). The expected animated-source behavior follows the [WHATWG Canvas image-source rules](https://html.spec.whatwg.org/multipage/canvas.html#image-sources-for-2d-rendering-contexts); browser conformance must still be observed. Neither research nor scoped modeled tests closes P05 or the full redesign.
