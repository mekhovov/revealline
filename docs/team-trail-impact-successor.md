# Team owned travelling-impact successor

Status: source candidate; not merged, released, publicly verified, or human balance-qualified.

## Scope

`team-trail-impact-originals-1` is the current-rules successor to
`team-spatial-originals-1`. It preserves the twelve accepted maps, original
pictures, actor placements, objectives, mission order, and three difficulty
presets. Historical Team routes and receipts remain unchanged and selectable.

The successor registers:

- `TeamMissionV5`
- `revealline-coop-level.v6`
- `revealline-coop-pack.v6`
- `revealline-coop.v8`
- `team-line-impact.v2` at authored speed `24`

## Ownership contract

Every exposed trail has a monotonically increasing, player-local `cutId`. An
enemy source can launch one pair of fronts per `(playerId, cutId)`: one front
travels toward the departure point and expires there, while the other follows
the live trail toward its owner. The fronts retain this identity if a partner
banks a different cut.

- Closing a cut clears only that cut's fronts.
- A joint closure clears each participating owner's fronts.
- Secured prefixes discard fronts on secured cells while fronts on a surviving
  suffix keep following that suffix.
- Knockdown, disconnect cleanup, and a later cut cannot transfer an old front.
- A valid closure wins a simultaneous craft-front arrival tie.
- Freeze prevents new enemy/emitter launches; already-launched fronts continue.
- Enemy slow does not change impact speed.
- Direct body contact, self-collision, and lethal terrain remain immediate.

Support continues to intercept any visible travelling front in its qualified
radius. Team's existing knockdown, rescue, shared-reserve, timed-bonus, terrain,
and changing-return contracts remain in force.

## Default and preservation

Queryless Team entry and the unified mission library target
`team-trail-impact-originals-1`. Explicit `team-spatial-originals-1`, pressure,
timed, greybox, and Legacy routes retain their existing validators and rules.
The new profile key is `team-trail-impact-originals-1`; it does not reinterpret
historical progress.

## Evidence boundary

Focused source checks cover all 36 mission/preset manifests, immutable content
preservation, unique simulation identities, source-per-cut seeding, partner
isolation, prefix trimming, later-cut isolation, closure ties, freeze, slow, and
historical Team regression cohorts. These checks do not establish public
delivery, physical-controller behavior, whole-Journey balance, or enjoyment.
The edition remains **balance review pending** until frozen-build and human
qualification are complete.
