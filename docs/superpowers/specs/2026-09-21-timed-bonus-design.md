# Timed optional bonuses — runtime and authoring design

Implementation slice B of the pressure/variety successor. User requested automatic
continuation. No new publication authority, no implicit alteration of old missions.

## Contract and alternatives

Use authored anchors with a deterministic seeded rotation. Pure random geometry
would make fairness hard to verify; a fixed anchor would not meet the request to
relocate a missed pickup. Keep existing fixed pickups and shared effect strengths.

Add optional `classic.timedBonuses` and corresponding optional mission
`timedBonuses`, containing `{version: 'timed-bonuses.v1', schedules: [...]}`.
Absence produces exactly the old runtime/state/replay. Older strict readers reject
the new descriptor rather than reinterpret it. The descriptor itself versions the
new semantics, as existing optional enemy-pressure and line-impact descriptors do.

Trail-aware successor: new Studio edits use `timed-bonuses.v2`, correcting live
trail exclusion for actual `{x,y,index}` trail records. The original v1 comparison
is retained only for exact historical reconstruction. Applying an edit upgrades
all schedules of that mission's new revision, not a live attempt. Historical
factory output defaults to v1 until explicit successor selection. See
[verification](../../verification/journey-timed-trail-v2.md).

Each schedule has required keys: id, kind, anchors[{x,y}], initialDelayTicks,
announcementTicks, availableTicks, cooldownTicks, maxAppearances, maxCollections.
Kinds are the four existing contact bonuses. Bounds:1–8 schedules;2–16 distinct
interior cell-centre anchors each; initial delay0–7200; announcement120–600;
availability240–2400; cooldown240–7200 ticks;1–12 appearances;1–3 collections not
exceeding appearances. Extra life is capped at one collection per schedule.
All counters/times are integers. Reject unknown/missing keys, duplicate IDs,
overlapping anchors (including other schedules/static pickups), walls, closed
relay gates, initial foundations and lethal terrain. Anchors must initially be
unclaimed field. Entity IDs share existing validation; no executable expressions.

## Deterministic state machine

Own a schedule clock incremented once per running simulation tick. Ordinary
recovery freezes this clock without resetting collected/appearance counts; pause
does not call the simulation; won/lost never advance. Enemy freeze does not freeze
bonus time. Initial clock0; start on the first running tick whose clock meets the
authored initial delay (zero therefore starts on the first tick).

Cooldown -> announce -> available -> cooldown, or exhausted when a cap is met.
Choose an initial rotation offset from seed+schedule ID without consuming another
system's RNG. Thereafter start after the previous materialized anchor; do not choose
that same anchor again. If no different eligible anchor exists, retry after a full
cooldown. A cancelled announcement consumes neither an appearance nor collection.

At announcement and materialization, require a field cell, no active lethal
terrain, no live trail, and at least two cells from craft and enemy bodies. Reject
reserved/visible scheduled anchors and fixed pickups. A conservative four-way path
from the craft must avoid walls, active lethal cells and live trail (except start),
with distance <= half the craft's unboosted travel budget during availability.
This is a geometric opportunity check, NOT a guarantee of safety against moving
enemies or a substitute for authored route testing. After materialization, it
stays still; later reclamation does not remove or collect it. If erosion makes its
cell lethal, cancel it without granting anything; the appearance remains consumed.

Each schedule has at most one active contact item. Only available items enter the
existing swept-contact collector. At the start of expiry tick, remove the item
before contact resolution: expiry wins that boundary. Existing collision/closure/
collection ordering inside a tick is unchanged. Contact applies existing capped
effects (life cap9); collection then counts toward the finite schedule cap and
starts cooldown or exhausts it. Failed collection grants nothing. No required
objective or completion check reads bonus state. Attempt restart repeats its seed;
suspension restores exactly; lives lost never replenish the grant budget.

State retains phase, deadline, current/previous anchor indices, appearance and
collection counts; active items are bounded to8 beyond the64 static item cap.
Projection/replay/suspension must include these fields. Equal Versus boards share
definitions/seeds; the schedule may diverge only in response to each player's
board, position and collection. Do not synchronize one player's pickup to another.
Team remains explicitly rejected until shared collection/schema semantics are
qualified; unsupported data must not be silently dropped.

## Presentation and Studio

Announcement: hollow/dashed outline and existing bonus symbol with a static
upcoming marker. Available: existing symbol plus shrinking outer ring and remaining
seconds. No flashing, colour-only signals or blocking dialog. Reduced effects must
retain the ring/countdown. Keep sprites optional and the semantic icon visible.
Information panel explains availability, collection and reappearance; terminal
results do not overlay timed bonus cues on the full picture.

Studio adds a separate timed-schedule section alongside fixed-bonus controls:
select/add/replace/remove, kind, semicolon-separated cell-centre anchor pairs,
seconds inputs converted to ticks, finite caps, explicit validated Apply and
two-step removal. Use the same compiler, copy-on-write mission/project revisions,
stale-context rejection and draft undo/checkpoints. Team controls disabled with a
truthful qualification explanation. Map overlays number all possible anchors and
label timing; they do not claim to predict moving runtime eligibility.

## Implementation and verification sequence

1. Strict descriptor/engine state, seeded rotation, eligibility and collection.
2. Replay/restoration and legacy absence identity checks; pause/recovery/terminal,
   expiry ties, capture-only, occupied/unreachable/all-ineligible anchors and caps.
3. Shared compiler/Studio CRUD, preview/transport and mode rejection.
4. Bounded immutable view, symbols/ring/countdown, reduced-effects and malformed
   state tests; native Studio/play observations on the exact candidate.
5. Explicit test missions with optional detours and different anchors. Verify
   bonus-independent clear routes, equal races, save recovery and uninterrupted
   flow. Do not enroll publicly before exact release review/qualification.

Initial authored example:1s announce,10s available,12s cooldown; not copied
Reloaded timings or a human-balanced final recipe. Difficulty catalogue does not
scale bonus timing in this increment. No remote telemetry, notifications or
retention manipulation. Keep prior95 candidates untouched until explicit adoption.
