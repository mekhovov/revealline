# Riy / Рій — C1 escort prototype

This is the C1 review deliverable after the Survivor/Raid continuation. The user
explicitly skipped unavailable target hardware and five-player checks; that waiver
is recorded in [the parent qualification](../continuation-20261013/README.md).
Neither those checks nor release acceptance are claimed here.

## Play

Open `game/overflight/play.html?prototype=riy&lang=en` (or `lang=uk`).
The native briefing explains the two support roles. Steer and boost as in Survivor;
press **F** or **Focus target** to commit both escorts toward a visible priority
for three seconds, with a six-second command cooldown. No extra home tile.

- **Sweeper:** wide, weaker hits; cyan tint and a wide role mark.
- **Breaker:** concentrated, stronger hits; amber tint and a narrow role mark.
- Focus prioritizes the final target, elite, armored machinery, guards, then ordinary
  enemies. Distance and stable identity break ties. Arriving and offscreen enemies
  cannot be selected. A target leaving the leader's 420-unit leash cancels focus.
- Their approach depends on the leader's position. Shared directional shields and
  armor still apply; positioning for a flank remains meaningful.
- Escorts are support equipment, not additional lives. They recall after losing an
  airframe. The leader retains ordinary contact damage, upgrades and enemy pressure.
- One native host owns the clock, pools, enemy library, character artwork, remains,
  audio, settings, upgrades, Studio entry and retry. The prototype adds no atlas
  frames: two pooled sprites reuse the selected drone animation.

## Evidence

- [Opening clip](opening.webm) and [later focus clip](later-focus.webm) are actual
  20-second native canvas recordings. They are silent and omit the DOM HUD/cards.
- [Focus screenshot](focus.png) includes the shared HUD and focus status.
- [Native diagnostics](native-diagnostics.json.gz): 217.02 simulated seconds,
  four accepted commands (button and keyboard), 152 Sweeper shots, 98 Breaker
  shots, nine upgrades, one lost airframe and defeated elite. The run was paused
  for inspection, **not completed**. Movement/upgrade selection used the clearly
  labeled existing review pilot; focus commands were issued through native UI.
  Recording overhead, interruption and dropped catch-up time invalidate performance
  qualification, correctly retained in the receipt. Master audio was muted.
- [106/106 regression checks](regression.tap): Survivor core, Raid contact core,
  host lifecycle, renderer and seven escort/input tests. [24/24 final focused
  checks](presentation.tap) include the additional renderer reuse test; cohorts overlap.
- The controlled same-world focus comparison moves escorts over 80 units farther
  toward the tank and damages armor untouched by follow behavior. Other tests
  verify group versus concentrated damage, directional guard mitigation, one-time
  death rewards, deterministic commands, paused clocks, cooldown, leash, airframe
  recall, menu input release and listener disposal.
- Reduced effects keep both escorts, reuse the same atlas and never mutate gameplay.
  [7/7 CI-registration checks](ci-registration.tap) also pass. Initial missing
  workflow/package fixtures were restored from tracked sparse-checkout inputs
  before the final run. Scoped lint, formatting and whitespace checks pass. [Source hashes](source.json).

## Review boundary and next design decisions

C1 is implemented as an opt-in native prototype; it is not a new stable content
format or a fully balanced campaign. Creator still authors the shared Survivor
encounter and assets; escort formation/role authoring is follow-on work. F and the
on-screen command are implemented; dedicated controller command mapping follows
acceptance of the command mechanic. Existing controller flight remains shared.

Review whether leaving cover to focus a heavy is worth the risk, whether the two
roles are visually distinct, and whether the three-second commitment is long enough.
Full formation design, additional escort content, Time Attack, Contract Marathon
and character-specific mechanics remain the plan's later variants. Publication and
merging are separate from delivering this review candidate.
