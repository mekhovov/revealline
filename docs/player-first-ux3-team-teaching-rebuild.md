# UX3 Team contextual teaching rebuild

## Candidate scope

This is an unversioned v0.136 local candidate rebased on the v0.135 navigation parent
`c6aca0bf82120f1d798d372081aa4b779a6b3a2b`. Package, lockfile and build identities remain at
v0.135 until the release coordinator assigns the release commit. This evidence does not claim a
release, public deployment or physical-device result.

The Team host adds three small, nonmodal lessons without changing simulation rules, missions,
scoring, artwork, input bindings or the existing mission briefing:

- **First cut** appears with a fresh unresolved Team attempt.
- **Support** appears after a successful cut only when the selected arena declares a relevant
  `slow` or `intercept` capability.
- **Rescue** preempts the other cues only after an authoritative `player.downed` event.

The mission's authored `startMessage` remains in the existing gameplay status row. Teaching uses a
separate polite status row, so a cue cannot replace threat, capture, recovery or mission guidance.
The same cue moves into Pause, where keyboard and modeled controller navigation can reach its
44-pixel **Got it** action. Touch can activate the visible action directly.

## Semantic and persistence contract

`coopArenaGuidance()` now exposes presentation-only mechanic IDs:

- `ground`: `safe` or `reclaimed`;
- `supportCapabilities`: `slow` and/or `intercept`;
- `supportRoles`: `hybrid`, `interceptor` or `disruptor` by seat.

The teaching controller never parses translated strings. English and Ukrainian copy use ordinary
`gameplay:team.*` localization keys and update in place when the locale changes.

`revealline.team-contextual-teaching.v1` stores only explicitly acknowledged and successfully
completed skill IDs. Merely showing a cue does not suppress it on Retry or a later visit. Support is
complete only when `support.pulse` contains a slowed enemy or intercepted impact; an empty pulse
keeps the lesson pending. Changing setup retains an unfinished Support lesson but hides it while the
selected arena has no slowable threat or interceptable spark. Rescue is complete only on
`rescue.completed`. Storage denial, malformed bytes and failed writes keep a bounded in-memory
session and never block play.

## Focused evidence

The local candidate includes unit and real Team-host coverage for:

- semantic capability/role selection and no localized-copy parsing;
- first cut and preservation of authored mission guidance;
- effective and empty Support pulses;
- setup changes between pressure and calm arenas while Support remains pending;
- authoritative downing, rescue start and completed hold-to-rescue;
- cue retention across Retry and dismissal after success or acknowledgement;
- English/Ukrainian live refresh;
- no automatic focus movement when cues appear or change;
- polite live-region semantics;
- modeled controller access through Pause and deterministic focus return;
- unavailable, corrupt and failed storage.

Commands and final counts are recorded with the local commit evidence. Full repository gates,
public release qualification and publication remain future coordinator work.

## Remaining evidence limits

The CSS stacks cue text and its action below 520 CSS pixels and contains no teaching animation, so
reduced effects does not alter mechanic timing. This source review does not replace native visual
inspection at portrait, short-landscape, 1280×800 handheld or 200% zoom. It also does not certify a
physical controller or touchscreen. Those checks remain blocking release evidence, alongside the
later deliberate terminal-Retry feature.
