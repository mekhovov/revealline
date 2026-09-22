# Team timed bonuses: engine qualification

2026-09-21. Successor engine work after `3b115809`. Not a published mission,
native-host validation, Team save-format claim or human playtest.

## Implemented

Explicit Team level v5 / ruleset v7 accepts the shared trail-aware v2 schedule
descriptor. Earlier levels reject it. No descriptor means no bonus state; removing
the last schedule can retain the explicit edition. At this gate the pack reader,
content compiler and Studio still refuse this unqualified mode combination.

The engine reuses Solo's bounded schedule state machine and shared geometry query.
One shared schedule announces, materializes, expires and relocates finite pickups;
both trails are excluded and either active pilot can provide reachability. A
downed pilot cannot collect. Old Solo v1/v2 outcomes and default factories remain
covered by their pinned input/replay fixtures.

Pickup contacts participate in Team's swept event horizon. Damage wins ties;
collection precedes capture/revival. Tied survivors share one collection event:
one reserve or one shared enemy effect, and speed for each actual tied collector.
The new authoritative `lastDamageTime` pair prevents a capture-revived pilot from
retroactively collecting at the same instant, including across a tick boundary.
Collection becomes possible once simulation time advances. This avoids both
zero-time loops and arbitrary seat priority.

Effects reuse shared durations/factors: speed1.25x/600ticks, slow0.5x/720ticks,
freeze360ticks, extra reserve capped at8. Speed applies only to the collector(s),
starts next tick, refreshes rather than stacks, and clears on damage. Enemy slow
composes with Support using the stronger effect. Effective swept velocities do
not overwrite stored headings; freeze does not divide by zero. Freeze pauses
roamer activation clocks and suppresses enemy body/trail contact as Solo does,
but not self-trail or lethal terrain. Pickup clocks keep advancing during freeze.

Scoped roles are keepers and reclaimed roamers, coverage goals, foundations and
terrain. Hunters/strongholds/encounter settings are rejected in v5 until qualified.
Roamers remain nonretaining in gameplay and shared capture previews.

## Verification and review

Seventeen new engine tests cover strict owned validation, historical rejection,
all four real-input collections, simultaneous public contact, bounded life grants,
public double-speed refresh, expiry, relocation caps, pause/ready/terminal clocks,
clone continuation, freeze/roamer warnings and stronger-only slow composition.
Adversarial unit arrangements separately cover damage+collection+capture revival,
tick-boundary persistence, survivor seat swaps and frozen-contact exceptions.
Those arrangements are labelled; they are not claimed as public route evidence.

Independent review found and reproduced three bugs during implementation:

- A JSON-string descriptor validated after parsing but was retained as a string.
  It now rejects before copying.
- A hidden outer descriptor disappeared during structured cloning. It now
  rejects instead of silently changing the authored mission.
- Same-time capture revival could re-enable collection on a second zero-time
  event pass. Planning and collection now share the authoritative damage-instant
  guard. The end-of-tick continuation test covers persistence across event reset.

The final combined engine, historical Team pressure-route and Solo timed-bonus
cohort passes **727/727 on Node20.19.5 and22.22.2**, no skips. It retains the
36 Team mission/preset sets with four joint-cut/seat configurations, delayed
samples and earlier failure evidence. Existing Solo collection/replay/equal-race
fixtures also pass. Lint, formatting and whitespace checks pass.

## Open before user-facing qualification

1. Exact compiler, exporter/importer and Studio CRUD/preview support.
2. Shared pickup and per-seat/shared-effect rendering, captions and Field details.
3. Actual Team host, input recovery, artwork transport and paused-resume checks.
4. Three purpose-built optional-route studies; pickup-free and pickup-taking
   clears, preset/seat/delay variants, native/device and two-human cooperation.
5. Integrated review and release-owner PR/version/immutable release/Pages gates.

The overall P02/P14 programme is not complete. No new release or gameplay menu
is enabled by an engine-only verification result.
