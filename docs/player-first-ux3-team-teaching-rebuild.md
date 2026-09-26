# UX3 Team contextual teaching rebuild

## Candidate scope

This is an unversioned local candidate built on provisional v0.134 source
`23841ae0f92195b45af70d2615ad611f5690857d`. It does not claim a release, public deployment,
physical-device result or dependency on the unreleased v0.135 navigation candidate.

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
keeps the lesson pending. Rescue is complete only on `rescue.completed`. Storage denial, malformed
bytes and failed writes keep a bounded in-memory session and never block play.

## Focused evidence

The local candidate includes unit and real Team-host coverage for:

- semantic capability/role selection and no localized-copy parsing;
- first cut and preservation of authored mission guidance;
- effective and empty Support pulses;
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
planned v0.135 navigation reconciliation and the later deliberate terminal-Retry feature.
