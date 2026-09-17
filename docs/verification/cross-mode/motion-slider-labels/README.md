# Motion sliders: stable names and current values

This correction gives all five existing Motion ranges stable purpose labels and current value text. Startup, ordinary input and rotor recipe replacement keep visible units and `aria-valuetext` synchronized. Native range bounds, steps, keyboard handling, simulation, paused intent and storage ownership are unchanged.

The reviewed source candidate was authored on `5f59f1dfdaca8df6fc737a1923631e120abdf580`. Its five exact preimages remain unchanged in the final v0.60.8 parent `cc161f7d97b2a90482e84d875a4360e4bf4afffe`; v0.60.9 adopts those reviewed five bodies plus version metadata and this evidence. The fpv27 producer ledger and all five production input fingerprints are inherited unchanged; this slider correction adds no artwork or producer revision.

## Evidence

- `browser/observation.json` describes the scoped headless Chrome CDP check, with byte-pinned original screenshots, DOM measurements and command observations. Served HTML/application bytes match the adopted runtime. All five visible labels focus their ranges; Home/End, native step arrows and Tab/ShiftTab work. Current units follow edits and recipe replacement while the study remains paused.
- Theme/Standard, Theme/Large, Plain/Large and Plain/Standard were observed. The portrait and short-landscape evidence establishes horizontal range fit at those scrolled positions; it does not claim all controls fit one screen.
- `candidate/verification.json` retains the two complete 38/38 host-test runs from the original candidate and its 35-pass/3-failure baseline. `review/independent-review.json` records the separate source/browser review. Final v0.60.9 tests and production-fingerprint checks are recorded separately in `final-source-checks/`.
- `originals-manifest.json` pins every copied original. Historical records retain their actual source names and dates and are not rewritten as later acceptance.

## Scope and open work

Baseline and final candidate test files have different pins (55,537 versus 55,665 bytes), and the exact baseline test body was not retained. The baseline result is only evidence at its own recorded hashes. Both candidate Node families have identical input manifests; no byte-identical baseline-to-candidate claim is made.

The retained browser run is headless Chromium through CDP, not foreground CUA, screen-reader or touch assistive technology, physical touch/controller, real 200% zoom, BFCache or public-release acceptance. Early offscreen Pause clicks that did not change state remain recorded; the successful checks scrolled controls into view first.

**Open P05 finding:** the existing Chromium Choose File button has pale text on a pale background in portrait (see `browser/07-portrait-large-sliders.png`). Its styling is outside this correction and remains unresolved. P03/P05/P18 remain open.
