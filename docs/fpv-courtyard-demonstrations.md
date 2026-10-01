# Ukrainian Courtyard demonstrations

World Studio adds recorded examples for every Ukrainian Courtyard challenge in
Self-level and Acro: 16 new v2 recordings. The existing 24 Academy and 16 Woodland
Park examples remain unchanged, giving 56 examples across 28 challenges. The
remaining worlds stay playable without an unavailable demonstration action.

Each courtyard recording completes its exact authored route with full health and
zero contacts. At horizontal speeds of at least 1 m/s, the recorded drone faces
forward throughout its travel and covers 98.11–99.94% of the distance within 45°
of its heading. Recordings last 24.14–56.98 seconds.

The Delivery Crossing example climbs before the moving traffic, crosses at 6.2 m,
then descends into the original hold zone and returns above the hazard. These are
recorded pilot commands; the courses, collision, actor rules and physics are
unchanged. Roofline Survey, Well-side Landing and Laneway Traffic demonstrate
their original high, precision and hazard routes.

Examples use the existing verified player with Self-level/Acro selection,
pause/resume, restart, half-speed playback, FPV/chase cameras and **Fly this
challenge**. Viewing does not earn completion, medals or playlist progress. Exact
normalized source and runtime checks prevent changed revisions from silently
reusing an old demonstration.

## Reproduction and retained evidence

The original portable generator is
`authoring/fpv-worlds/demonstrations/generate-courtyard.mjs`; its README documents
the recording recipe and piloting choices. A second fresh generation reproduced
all 16 complete artifact hashes. `courtyard-provenance.json` preserves the source
commit, generator hash, per-proof hashes, identities, final-state evidence and
heading measurements. The previous woodland proof hashes were checked unchanged
when appending the courtyard batch.

The courtyard proofs contribute 624,086 bytes of data. No generator or autopilot
is included in the player runtime.

## Player verification

- All 16 new proofs replayed in Node and Chromium's shipped WASM runtime to
  completion with full health and zero contacts. Existing woodland proof hashes
  remain exact.
- The catalogue shows 28 example links and labels the 56 mode-specific examples
  accurately. Uncovered Warehouse challenges show no example action.
- The visible Roofline Survey playback completed. Mode selection, restart,
  half speed and returning to a disarmed player attempt worked with zero
  JavaScript errors.
- FPV and chase views were inspected on Courtyard 03, 04, 06 and 07. The observed
  markers remained ahead, the well-side hover held beside its obstacle, and the
  Delivery Crossing recording passed above the moving hazard before descending.
- The packaged application reloaded offline and completed Well-side Landing.
  Delivery Crossing and Laneway Traffic views were also inspected offline;
  these walkthroughs reported no JavaScript errors.
- Ukrainian controls fit an emulated 390×844 viewport without horizontal overflow.
- Focused lint, syntax, whitespace and build checks passed. The separate playtest
  has 74 files and 10,169,014 bytes, within its existing optional-runtime allowance.

This remains a development playtest; final
unfamiliar-player review, physical-device performance and the remaining 64
mode-specific examples are outstanding. Unit-test expansion remains deferred to
the final qualification phase.
