# Shared flight-response guide

The Academy and World Studio now render one observer-only component beside the
live controls. It separates requested thrust/rotation, quaternion attitude and
measured vertical/horizontal velocity. Centred sticks never imply that an Acro
drone has levelled or stopped drifting. The fixed ground reference, marked nose,
amber thrust arrow and cyan travel arrow remain meaningful through inversion.

Off, Compact and Learning displays and standard/large text persist. Learning
practice retains the compact display; opening the full lesson explanation pauses
and gives that explanation the viewport. Phone portrait layouts separate the
objective, schematic and sticks; bounded scrolling prevents expanded panels from
clipping their heading or close control. Existing Mode 1–4 stick mapping remains
owned by the input presentation. The component cannot generate commands or award
progress. Screen-reader announcements change for meaningful flight phases and
inversion instead of every telemetry sample.

## Functional verification, 1 October 2026

- Real in-app Chromium browser: World Studio flight, recorded demonstration,
  persisted Learning/Large selectors, Acro lesson explanation/live transitions,
  deliberate Pause and accessible localized selector names.
- Academy: actual demonstration completion, recorded thrust and measured climb,
  Learning/Large view, Ukrainian wording, hiding and persistence after reload.
- World Studio at 1280×720, 390×844 and 844×390: checked schematic/coach/stick
  placement. Found and repaired desktop clipping and portrait overlap. The
  Academy phone-specific visual pass remains in final cross-device qualification.
- A local browser observer fixture displayed upright, inverted, 130-degree bank
  and changed-heading snapshots. All showed 85% requested thrust independently
  from measured descent of 1.4 m/s and horizontal travel of 2 m/s. Frozen state
  and command objects were unchanged. This fixture is visual verification, not a
  physical-device or performance measurement.
- Scoped syntax, ESLint, formatting and diff checks passed. Frozen candidate
  `72b508f53f6e7c70cb08f95acf82e767ffe6dd30` passed all three optional package
  admissions, committed-input verification and two byte-identical builds.
  Academy is 62 runtime/64 source files; World Studio 94/96. The unused Academy
  wordmark image dependency was removed from its closure; World Studio keeps it.
  Neither package limit changed.

The public native-UI application was opened separately and failed at startup with
`ReferenceError: lastRadioDiscovery is not defined`. The minimal declaration
correction is included locally and is also being published in the independent
creator/startup repair. Public deployment-marker access returned
`ERR_BLOCKED_BY_CLIENT`; no new feature is claimed live from this verification.

No new unit suite, physical-radio acceptance, five-beginner acceptance, or
hardware frame-rate/memory result is claimed. Those gates remain explicit in R7.
