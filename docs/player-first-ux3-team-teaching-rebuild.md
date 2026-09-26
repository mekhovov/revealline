# UX3 Team contextual teaching rebuild

## Candidate scope

This is a v0.141.4 local candidate on exact v0.141.3 navigation parent
`e1dba137ad7fd16c874cb511cbc801ce6ce309f7`. Package, lockfile and build identities identify
v0.141.4. The local branch is `codex/team-teaching-v1414-candidate`. This evidence does not claim a
push, PR, release, public deployment or physical-device result.

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

The semantic controller and real Team-host files pass 11/11. Complete Team host, quick-start and
shared Pause files pass 88/88. Complete inherited Couch-shell and localization files pass 30/30.
Repository validation passes with 9,940 localized messages, 7,450 source references, 1,245 game
files and presentation revision 91. Scoped ESLint, Prettier, native formatting, syntax, version
parity, generated-catalog freshness and diff checks pass.

## Remaining evidence limits

The CSS stacks cue text and its action below 520 CSS pixels, contains it inside the narrow board
footer, and contains no teaching animation, so reduced effects does not alter mechanic timing. No
browser surface was available to this isolated task, so portrait, short-landscape, 1280×800,
200% zoom and reduced-effects visual checks remain required on the eventual accepted predecessor.
Automated modeled input does not certify a physical controller, Steam Deck or touchscreen. Those
checks remain separate release evidence, alongside the later deliberate terminal-Retry feature.
