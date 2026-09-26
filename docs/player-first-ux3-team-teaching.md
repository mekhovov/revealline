# UX3 Team contextual teaching slice

## Scope

This draft adds one bounded player-first teaching feature to the Team host. It does not change the
Team simulation, mission recipes, scoring, artwork, controller routing or release metadata.

The shared arena now uses its existing live message row to introduce three skills in context:

- the first short cut appears when the first Team attempt starts;
- Support appears after a successful cut only when the selected arena has a threat that Support can
  affect;
- rescue appears when a player is actually downed.

The cue uses the existing board footer so the 2:1 arena, HUD and touch gutters keep their current
geometry. A small coloured rule identifies teaching without adding another panel or modal.

## Teaching lifetime

`revealline.team-contextual-teaching.v1` stores only finite skill names: introduced and completed.
Demonstrating a cut, Support pulse or rescue records completion. An introduced cue does not repeat on
Retry or a later visit. The full How to play text remains available for players who want to revisit a
mechanic.

Storage denial, malformed older bytes and failed writes retain a bounded in-memory session. They do
not block play or alter an attempt.

Tutorial decisions use semantic ground and Support capabilities rather than parsing translated
labels. The host resolves cue keys through the live English/Ukrainian catalog, so a locale change
updates future cues without changing simulation state.

## Focused evidence

- `node --test game/test/team-contextual-teaching.test.mjs`: 5/5 pass.
- `node --check game/couch/team-contextual-teaching.mjs`: pass.
- `node --check game/couch/relay-rescue.mjs`: pass.
- Scoped ESLint: pass.
- Scoped Prettier and `git diff --check`: pass.

The tests cover first-use order, Retry suppression, threat relevance, persistence across visits,
successful skill completion (including same-step success), unavailable/corrupt/failing storage and
invalid API input.

## Remaining qualification

This source-level slice still needs integration after the compact gallery and Couch navigation
releases settle. Public browser review must exercise a cut, a Support pulse, a downed player and a
completed rescue at portrait and short-landscape sizes. Physical touch and controller hardware are
separate evidence; modeled or browser input must not be reported as hardware certification.
