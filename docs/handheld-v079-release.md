# v0.79.0 — shared handheld controls and compact play

Status: release candidate, not published. Based on accepted main `595fdadd`
(v0.78.0) and device candidate `8c81c9b3`.

## Player-visible changes

- Solo, Versus and Team retain the same touch steering vocabulary and shared
  preferences. An ignored extra finger cannot cancel another active gesture.
- Landscape gameplay reclaims empty space: compact soundtrack/Pause controls,
  Team corner pads and complete arena sizing through 600px height, plus smaller
  Solo notice space on authored missions without warning-card threats.
- Resizing while steering cancels that captured gesture and pauses safely.
  Idle resizing does not pause, and returning focus never resumes a flight.
- Fullscreen handles repeated activation, denial, retry and retired requests.
  It remains optional; the game fits the browser viewport without it.

## Evidence and remaining release gates

The device composition passes76/76 focused tests on each Node20/22 runtime and
native browser keyboard/D-pad/Team checks. Its full source qualification passes;
full-test run35604260193 is still in progress at preparation time. The exact
versioned merge must pass its own final source/test/freeze gates before release.
See [device evidence](verification/device-composition/README.md),
[compact music](verification/compact-track-hud/README.md),
[stronghold layouts](verification/compact-track-hud/stronghold/README.md), and
[Solo caption space](verification/solo-caption-compaction/README.md).

Physical iPhone Safari and Steam Deck/DualSense qualification remain explicit
P18 gates. Browser layout and modeled controller checks do not establish them.
Pads can overlap lower-corner cells; full-picture fitting does not imply every
cell is unobscured. This release does not complete the campaign/content backlog,
Team artwork adoption, P06/P16 recovery, or native-store/network phases.

Preserve immutable v0.78.0 and its rollback route. Publish only after the source
PR, final qualification, frozen release, publication selector and complete public
inventory/affected journeys pass. Do not overwrite the previous release.
