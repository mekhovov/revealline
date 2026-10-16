# Regional continuous streaming — bounded source review

The unscored regional production session now stages its next verified geometry
window while the current committed frame remains usable. Ordinary cell crossings
and local-origin changes do not require another Arm action. Initial preparation,
explicit pause, and recovery from unavailable collision still require deliberate
arming. This does not admit regional sources to the public Library.

## Ownership and correctness

- Continuous mode is explicit in the shared regional runtime. The production
  regional session opts in; the existing authoring/manual prototype defaults and
  scored World.v1 model are unchanged.
- Only the already committed, verified geometry remains queryable while a
  successor is loading, cancelled or failed. No unverified asset is exposed as
  collision. Every movement sweep and support query still rejects unknown cells.
- A single pending request looks at most 96 m ahead using three seconds of the
  current horizontal velocity. Existing source/geometry budgets include retained
  and staged resources; mixed layers retain the 32 MiB source / 10 MiB geometry
  ceilings. Failed look-ahead requests wait 100 accepted simulation ticks before
  retrying. No additional asynchronous queue or physics engine was added.
- Immediately before synchronous adoption, the trusted runtime supplies its
  **current** pose. The staged frame checks current support and scenery overlap.
  A pose captured when transport began cannot authorize a stale frame.
- The group, origin, drone and camera anchor adopt together. Async preparation
  does not change world position, velocity, rotation, accepted ticks or arming.
  Pause, replacement, manual preparation and disposal invalidate stale callbacks.
- If actual movement needs unavailable collision, the candidate is rejected
  before physics state or accepted time advances. Recovery stays paused.

## Functional evidence

`node authoring/fpv-worlds/regions/verify-continuous-flight.mjs` uses generated,
hash-verified canonical sources, pinned collision queries and the shared flight
transition. Five checks pass:

1. Mixed flight accepts 2,200 ticks across four cell crossings and five local
   frames without re-arming. Every accepted physical state equals the previous
   conservative shared-physics runtime, and asynchronous adoption changes none
   of that state. Source and geometry reservations stay within their limits.
2. Delayed companion transport allows more than 100 active ticks on retained
   geometry, then stops before unknown collision. Recovery preserves the body
   and stays disarmed.
3. Both standalone terrain and standalone scenery profiles cross cells while
   active, with at least three local frames each.
4. Corrupt look-ahead bytes cannot replace usable geometry. Explicit pause
   cancels a delayed successor without moving or arming the body.
5. A live pose outside the staged window rejects adoption. Old queries and exact
   provenance remain valid; cancellation/disposal release staged reservations.

Existing checks also pass: six manual regional flight scenarios, eight mixed
owner scenarios, twelve synchronous frame transaction scenarios, and the real
Urban mixed-source production-session adapter check in both flight modes.
Scoped production lint and JavaScript syntax checks pass.

## Remaining qualification

This is functional source evidence, not a device FPS or public package claim.
Native browser checks, exact candidate packaging and immutable regional content
delivery remain separate acceptance work. Source compilation still happens on
the main thread and needs sustained workload measurement. Real radio/handheld
hardware, offline regional content delivery, catalogue promotion, and larger
world/art acceptance remain outstanding. Existing `playerReady:false` and
unscored review identity remain honest until those requirements are met.
