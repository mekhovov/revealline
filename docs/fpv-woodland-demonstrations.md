# Woodland Park demonstrations

World Studio adds recorded examples for all eight Woodland Park challenges in
Self-level and Acro: 16 new v2 recordings, alongside the unchanged 24 Academy
examples. The application now offers 40 examples across 20 challenges. Challenges
in the remaining worlds stay playable and do not show an unavailable example.

Each woodland recording completes its exact authored route with full health and
zero contacts. The recorded drone turns toward the next leg before accelerating;
at horizontal speeds of at least 1 m/s, all recordings have 100% forward travel
and 98.67–100% of their distance within 45° of the drone heading. Recordings last
23.68–51.72 seconds. These measurements include braking and objective transitions.

The new examples use the existing demonstration player: mode switching,
pause/resume, restart, half speed, FPV/chase views and **Fly this challenge**.
Viewing does not grant rewards, mark completion, update playlist progress or
replace interrupted-flight recovery. The original v1 courses/proofs, new-world
course definitions and physics are unchanged.

The application checks a full normalized course fingerprint plus runtime and
response identity before offering an example. It then validates all v2 identities
and the final state by replaying the selected proof before showing playback.
Custom or changed revisions do not inherit a demonstration just because their
course ID matches.

## Authoring and evidence

The portable original recording generator and per-proof provenance are retained
under `authoring/fpv-worlds/demonstrations/`; see its README for reproduction.
All 16 output artifacts reproduced byte-for-byte from the retained script. The
runtime ships only 588,378 bytes of recorded data and source fingerprints, not
the generator or a gameplay autopilot.

## Player verification

- All 16 shipped proofs replayed independently in Chromium through the pinned
  WASM runtime, each completing with full health and zero contacts.
- The catalogue shows 20 example links, one for each covered challenge; uncovered
  Courtyard challenges show none. Mode switching, restart, half speed and returning
  to disarmed practice worked with zero JavaScript errors.
- Actual FPV and chase views were inspected on Woodland 01, 02, 06 and 07. Route
  markers and landing pads remain ahead on the observed travel legs. The Crossing
  Trail recording returned above its hazard at 6.2 m; Low Branch Line returned at
  2 m. The multi-turn Three Clearings example completed in the visible player.
- The generated application installed offline, reloaded with networking disabled,
  and completed the first woodland demonstration. The additional hazard-route
  views were also inspected offline, with zero JavaScript errors.
- Ukrainian controls fit an emulated 390×844 viewport without horizontal overflow.
- Focused ESLint, syntax and build checks passed. The separate playtest contains
  74 files and 9,544,081 bytes, within the existing optional-runtime allowance.

The implementation retains the development-playtest qualification. Final
unfamiliar-player review, physical-device performance and the remaining 80
mode-specific examples are still outstanding. Unit-test expansion stays in the
final qualification phase.
