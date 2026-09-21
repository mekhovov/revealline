# Team timed bonuses — implementation contract

Next P02/P14 qualification slice after the trail-aware Solo successor `2ab86e24`.
This document does not enable Team schedules. Existing compiler rejection remains
until the engine, transport, presentation and actual host agree on this contract.

## Research and purpose

[AirXonix's developer rules](https://www.axysoft.com/airxonix/) distinguish hidden
field balls from reclaimed-ground mines and describe life/slow bonuses.
[Cubixx HD's developer article](https://blog.playstation.com/2011/09/15/cubixx-hd-coming-to-psn-with-7-player-multiplayer/)
documents cooperative area capture and enemies with different actions. Neither
source specifies fair shared pickup arbitration or our timings. The following
rules are original design choices, not purported Xposed Reloaded behavior.

Purpose: one pilot can pursue an optional opportunity while the other maintains
a useful cut. Do not reward both pilots waiting together, require a pickup to
clear, or penalize a player for choosing the ordinary capture route.

## Edition and scope

- Reserve Team level v5 / ruleset v7 / pack v5 and `TeamMissionV4` for this
  successor. Do not register these selectors until the runtime exists. Historical
  v1–v4 levels retain their exact state, imports, actor and capture contracts.
- Optional `timedBonuses` descriptor uses `timed-bonuses.v2` when present; reuse the shared
  schedule shape, bounds and four effect kinds. Shared validation/registry must
  reject unknown fields/versions, unsafe getters, duplicate IDs and anchors.
  Removing the last schedule removes the descriptor but retains the explicit
  Team v5 edition; do not silently downgrade the mission or block normal CRUD.
- Foundation geometry, terrain and reclaimed roamers are included. First scoped
  candidates use qualified keepers/roamers and coverage only. Hunter/stronghold,
  relay-gate, erosion and directional-field combinations remain rejected until
  separately supported; no silently dropped mechanics.
- Studio editing is explicit copy-on-write Apply to a new mission revision. No
  automatic promotion of the twelve existing Team missions.

## One shared schedule, two eligible pilots

One schedule clock and one active item per schedule for the shared board. Use the
Solo deterministic seed/ID anchor rotation, announcement, expiry, cooldown and
finite appearance/collection caps. A miss rotates to a different eligible anchor;
no eligible alternative means a full cooldown before retry. No seat-dependent RNG.

At announcement and materialization, reject both active trails, walls, active
lethal terrain, reclaimed anchors, reserved/visible pickups and proximity to
either pilot or nonremoved enemies, including dormant/warning roamers as
conservative proximity reservations (matching Solo). Use numeric `.index` values of actual trail
records. At least one **active** pilot must have a four-way path within the
unboosted half-window distance budget; exclude both trails except that pilot's
starting cell. Evaluate both pilots symmetrically; downed pilots cannot provide
reachability or collect. This is geometry opportunity, not a promise of safety.

Clock advances only while the shared world runs; pause/ready/won/lost freeze it.
One downed pilot does not pause the world or bonus. Instant shared recovery does
not refund appearances/collections. Restart creates a fresh seeded attempt.
Materialized pickups stay put even if enclosed; enclosure never grants them.

## Swept contact and effect ownership

Integrate pickup contacts into the existing Team event horizon, not end-of-tick
distance tests. Resolve damage before collection at exact ties; a downed pilot
cannot collect, but a surviving pilot with tied contact can. Collection happens
after all tied damage and **before capture and its possible partner revival**,
then normal recovery/goal evaluation; terminal outcomes freeze future clocks.
This prevents a pilot downed at contact from being revived by a partner's tied
closure and retroactively receiving the pickup. Pin this combined tie in a test.
Expiry at the start of its boundary tick wins over a same-tick contact.

An item grants **once**, regardless of contacts. Earliest surviving contact wins;
contacts tied within the engine's existing EPS tolerance are a sorted set of
collectors, never an arbitrary seat-one winner. Emit one collection event with
the collector IDs. Removing the item must guarantee event-loop progress.

- Extra life: one shared reserve, capped at eight reserves (one active team life
  plus eight reserves corresponds to Solo's nine-life cap). No immediate revive
  except through existing recovery logic. Consumes the finite pickup even at cap.
- Player speed: 1.25× for 600 simulation ticks, applied only to the collector (both
  tied collectors receive one same-window effect). No multiplicative stacking;
  repeat collection refreshes one bounded window. Terrain still applies. Clear
  a downed pilot's speed effect, as Solo clears it on ordinary recovery.
- Enemy slow: 0.5× for 720 ticks, shared across eligible moving enemies. Compose
  with support slow using the stronger slow, not multiplying effects. Never
  divide by zero or overwrite authored velocities/headings.
- Enemy freeze: zero movement for 360 ticks; freezes actor warning/activation
  clocks as Solo does, not the schedule or player clocks. Freeze overrides slow;
  slow expiry still advances during freeze. Match Solo by suppressing eligible
  enemy body/trail contacts during freeze; self-trail and terrain hazards remain.

All four durations/factors come from existing shared policy/constants, not a new
per-mission override. Apply movement effects from the next tick after collection,
matching Solo; do not retroactively change a computed contact horizon.

## State, transport and presentation

Authoritative Team state owns schedules, active items, shared enemy effects and
per-pilot speed effects. Include their exact values and descriptor edition in
deterministic evidence/projection. Do not claim Solo replay/suspension support for
Team merely because structured clones continue. Explicitly qualify any existing
Team resume/transport boundary; unsupported readers must fail closed.

Compiler, pack exporter/importer, Studio preview, Journey selection and actual
Team host must all resolve the same edition. Capture preview excludes roamers
under v7 just as v6; pickups never become field-retaining seeds.

Use shared bonus silhouettes, announcement outline, shrinking availability ring
and readable seconds; show shared enemy effect expiry and per-seat speed expiry.
Extra-life text says shared reserve. Field details and captions explain contact,
expiry, relocation and affected pilot(s). Reduced effects and muted audio retain
the same information. Do not silently render an unknown timed descriptor.

## Delivery slices and gates

1. Shared eligibility/state-machine extraction only if historical fixtures stay
   byte/identity exact; Team schedule unit tests for both-trail exclusion,
   any-active-pilot reachability, seat permutation, finite relocation and pause.
2. Explicit engine edition with all four bounded effects and swept arbitration.
   Test death/closure/contact/expiry ties, simultaneous contact, support overlaps,
   freeze warning/roamer clocks, down/revive, caps and non-stacking.
3. Compiler, transport, Studio editor/overlays and Team presentation/host. Keep
   unsupported authoring closed until all are available. Verify exact imports,
   malformed input refusal, stale edits and separate pause/resume.
4. Three purpose-built optional-route studies, not automatic Solo conversions.
   Demonstrate pickup-free and pickup-taking clears at all three presets, both
   seat assignments and delayed seeds. Team currently has continuous steering,
   not Solo's Immediate/Grid-center pair: qualify actual keyboard/gamepad/touch
   input and fresh-direction recovery rather than inventing a second policy.
   Test useful complementary
   roles; scripted success is only feasibility. Retain the old 144 Team cases.
5. Independent review, actual host/native/device checks, two-human assessment,
   immutable candidate export and coordinated release-owner PR/version/Pages.
   Label builds as test content while human qualification is pending.

Do not mark P02 or P14 complete on engine-only tests or this design document.

## First implementation slice: eligibility only

The shared `hasBonusOpportunity` query now serves Solo and the Team qualification
wrapper. Historical Solo supplies its original trail set; the corrected edition
supplies actual cell indices. Team supplies both trails/bodies and active-pilot
origins. No edition selector or Team schedule is enabled by this extraction.

Six new tests include public two-pilot steering with real trail records,
seat-order invariance, no mutation, downed-pilot exclusion, lethal/wall barriers,
occupied cells and dormant-rover clearance. Together with the Solo timed cohorts,
407 tests pass on Node20.19.5 and22.22.2. The separate actual Solo host and
classic/foundation transport cohort passes65/65 on both after extraction, using
the exact-revision sparse JSON adapter documented in the Solo verification.

Independent review found no primitive blocker: 2,400 deterministic comparisons
matched the previous Solo function across descriptor editions, and another2,400
matched multi-origin search to the OR of separate single-origin searches. Those
are reviewer probes, not an additional committed test count. Review also corrected
freeze contact parity, capture-based revival ordering, remove-last semantics and
the actual Team steering scope above. Remaining slices1(state machine)–5 are open.

## Engine successor

The next slice implements the reused schedule state machine, explicit levelv5 /
rulesv7, all four effects and swept contact arbitration. Qualification evidence
and remaining user-facing gates are in
[Team runtime verification](../../verification/journey-team-timed-runtime.md).
The damage-instant guard is authoritative (`lastDamageTime` per seat), not just
an event-history filter: exact end-of-tick damage must remain excluded when the
next tick clears its events. The compiler, pack reader and Studio remain closed
until slice3 is complete. Human/device and publication gates remain open.
