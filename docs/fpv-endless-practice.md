# FPV endless controls practice

## Behavior

The controls lab now supports continuous manual practice. It does not stop after
the former one-minute lab timer or underlying 12-minute attempt limit, after
touching the ground, or after reaching
the practice boundary. Ground and boundary contact still resolve through the
existing flight integrator; this change removes the lab's automatic stop rather
than removing collision. The bounded practice space extends 80 metres in either
horizontal direction from the origin and from ground level to 80 metres high.
It is a 160 × 160 metre horizontal area, not an unlimited world.

Keyboard, touch gimbals and a selected calibrated radio/controller retain
automatic input takeover and normal-speed manual flight. **Pause**, **Reset
controls** and **Replay example** remain available. A replay returns to the slow,
clearly labelled looping example; it does not erase or restart the real lesson.
Reduced-motion preferences retain explicit playback and a single example cycle.

**Fullscreen practice** opens a dedicated view with the drone in the centre,
interactive gimbals in the lower corners, a compact toolbar and optional touch
buttons. The schematic follows heading from behind while retaining the full
flight quaternion, including Acro inversion. A wider ground grid and horizon
make translation, height and rotation easier to distinguish. Ground movement
uses measured position; height changes the diagram's bounded camera framing.
This is a teaching schematic, not another photorealistic game camera.

The portrait layout keeps the drone large by cropping the outer scenery. Its
peripheral SVG height label and ruler are hidden because the separate telemetry
still shows height. Instructions and detailed axis explanations remain available
in the inline lesson. Toolbar, telemetry and explanatory text support English
and Ukrainian.

Native fullscreen is requested through the existing application shell. When the
browser does not allow it, the dedicated full-window layout remains usable.
**Back to lesson** returns to the inline guide. Practice only exits fullscreen
that it opened itself; a pre-existing application fullscreen session is
preserved. Native fullscreen exit safely returns to the guide.

## Isolation and limits

The lab runs a separate `unscoredPractice` flight and cannot arm, advance, score
or record the paused lesson. A recorder explicitly rejects an unscored flight,
so this runtime-only option cannot create a flight proof. The option is not
serialized into the unchanged v1 flight identity or snapshots. Normal scored
attempts retain their existing 12-minute limit, recorded-input format,
demonstrations and reward rules.

Focus loss, visibility changes, stalls, disconnects and nested menus retain
their existing pause and input-release behavior. Reconnecting does not resume
practice automatically. Presentation transitions release rotation controls and
may preserve manual throttle for a still-focused active lab; they never arm or
resume the actual lesson. Reset and replay remain deliberate player actions.

The propeller and motor-demand cues retain the limitations documented in
[FPV motion teaching](fpv-motion-teaching.md): they illustrate the command mix,
not measured RPM, an ESC model or motor-level physics. No new assets, runtime
dependencies, package limits or global publishing rules are introduced.

## Local verification checkpoint

The implementation checkpoint includes:

- 14 coach checks in an actual browser, including controlled manual practice
  beyond 13 simulated minutes, with host lesson isolation and lifecycle checks.
- 27 model checks, including the original 24 demonstration proofs and explicit
  separation of unscored practice from ordinary attempt expiry and proof creation.
- Replay of all 14 Acro school demonstrations.
- 19 production-host browser checks with controlled radio/keyboard input;
  fullscreen and lab leave scored state unchanged, and keyboard takeoff works
  after preview.
- 16 diagram checks in an actual browser for the expanded presentation and
  unchanged compact/inline behavior.

These are functional verification results, not newly added unit-test coverage.
Frozen package qualification remains pending at this documentation checkpoint. Exact receipts, publication heads and subsequent
qualification belong in the delivery log. Nothing here claims public live
availability, physical-radio acceptance, unfamiliar-player acceptance or measured
hardware performance. Additional unit coverage remains in R7.

This player-feedback increment is estimated at **1–2 working days**, including
functional qualification and focused publication. The remaining R4–R7 art,
content, demonstration and final qualification work is unchanged.
