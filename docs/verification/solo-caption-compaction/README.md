# Solo landscape caption-space correction

Candidate after compact HUD `855f9981` and its scoped evidence `1080d32c`.
Not integrated, versioned, published or accepted as a complete device phase.

## Player-visible change

A manual-equipment mission previously reserved a warning-card band even when its
authored enemies cannot produce that card. First Signal at568×320 Large/Plain
reserved92px below a56px header. Its complete4:3 arena measured229.328×171.992px.

The new authored capability distinguishes warning cards from equipment controls.
For ordinary field/line enemies, the layout reserves only two lines of notices
plus clearance (54.8px at Large). The same arena measures278.930×209.195px:
about48% more drawable area. The top telemetry remains44px; Pause remains88×44px.
Actual touch directions retain44×44px targets, and manual Scan/Boost remain52px
high. The complete bitmap fits; translucent thumb/equipment overlays still cover
some lower corner cells. This is not a claim that every cell is unobstructed.

Warnings remain conservative for unknown/new enemy roles, staged encounters and
unrecognized level shapes. Legacy validated v1 levels explicitly have no encounter
field. The existing Arcade chrome decision, abilities, simulation, score, save,
replay and capture-stop policy are unchanged. Live actor removal or warning phase
cannot resize the board. Training and portrait rules remain unchanged.

Long notices stay within the reserved band with scrolling; the existing paused
Field details remains the full reading route. Native cascade inspection caught
the older classic-card selector overriding `max-height`; the final selector
includes that same card scope rather than relying on source order alone.

## Evidence

- Forty checks pass independently on Node20.19.5 and22.22.2 across six complete
  files: compact arena, actual Solo captions host, touchscreen/controller host,
  couch shared touch, shared preferences and touch steering. No skips/failures.
- Each final run recorded624 source reads across272 unique paths. Candidate
  postimages and pinned855 Git fallbacks were hash-checked. TAP files retain exact
  bytes as JSON text plus hashes. Five-case setup/candidate failures and transient
  disk-full failure are retained in the local trial, not counted as passes.
- The real browser ran the ordinary app inside an isolated568×320 iframe to
  avoid changing another task's shared viewport. The outer viewport remained
  1280×720. This exercises iframe CSS/media-query geometry, not iPhone chrome,
  standalone/fullscreen lifecycle, physical touch or Steam Deck hardware.
- Actual keyboard Pause → Game menu → Settings → Controls → native select
  Always/D-pad → Escape retained the paused10:27 attempt and returned focus to
  Settings. Explicit Continue resumed it. A pointer click on Move down then
  completed the cut, revealing50%, retaining3 lives and awarding7,820 points.
  The long total attempt time includes idle inspection; it is no difficulty proof.
- Browser console warning/error reads were empty. `measurements.json` and
  `pads.json` are the measured baseline/initial correction; `final-measurement.json`
  records the final cascade result. Screenshots show the complete outer test page,
  including the empty surrounding fixture area. They are not device screenshots.
- ESLint, Prettier and Git whitespace checks pass for the changed source.

## Remaining release work

Rebase/compose only after accepted v0.78, reproduce changed presentation recipes
without rewriting history, rerun required source gates and whole-device journeys,
then version/PR/publish and verify actual Pages bytes. Include warning-capable and
staged maps, wide maps, breakpoint neighbors, longer localized notices, real touch
and controller use. The shared input cohort proves modeled behavior only.

The preserved local fixture is `.cache/shared-device-r1/solo-caption-trial`;
the read-only preview is `.cache/shared-device-r1/compact-track-preview`. This
packet's browser composition includes the earlier held Team landscape CSS, but
the new correction is scoped to Solo and does not admit that Team source.
