# UX3 Team contextual teaching slice

## Scope

This candidate adds one bounded player-first teaching feature to the Team host. It does not change the
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
updates an active cue and future cues without changing simulation state.

## Focused evidence

- contextual teaching unit and live-host tests: 8/8 pass;
- the Team navigation, localization, Collection context, gallery focus and specialist integration
  set: 124/124 pass;
- `npm run i18n:check` and `npm run validate`: pass;
- scoped ESLint, Prettier and `git diff --check`: pass.

The tests cover first-use order, Retry suppression, threat relevance, persistence across visits,
successful skill completion (including same-step success), unavailable/corrupt/failing storage and
invalid API input. The live host also preserves its arena-specific opening rule, updates active cut,
Support and rescue cues between English and Ukrainian without advancing play, and clears coach
styling before terminal results.

## Remaining qualification

The integrated v0.141.7 candidate is rebased onto accepted public main
`494bc6a5144b9a47c663806e033132791c9af613`. Hosted exact-head qualification and immutable
publication remain open. Browser review must exercise a cut, a Support pulse, a downed player and a
completed rescue in English and Ukrainian, then verify Retry suppression and terminal styling at
portrait and short-landscape sizes with reduced effects. Physical touch and controller hardware are
separate evidence; modeled or browser input must not be reported as hardware certification.
