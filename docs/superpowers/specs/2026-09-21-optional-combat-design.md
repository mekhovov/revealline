# Optional combat patrols — versioned Solo/Versus foundation

Status: proposed detailed D2 specification; independent review pending. The user
authorized automatic continuation, so documented decisions and review replace
routine approval pauses. This does not authorize publication without technical
gates or invent human acceptance. Music remains paused.

## Purpose and decomposition

Add optional, visibly distinct non-retaining characters that can be removed by
craft contact or territory capture. Their purpose is a new route choice: approach
and remove a sentry, cut around it, or ignore it while evading a readable shot.
They must not replace ordinary dangerous keepers or turn every mission into a
shooter. Use non-graphic pixel robots first; a fictional trooper cosmetic can
follow the same contract. No civilians, nationality caricatures, gore or realistic
dismemberment; no operational drone-building content.

The full feature spans four deliverable increments, none alone is release-ready:

1. **D2a (this implementation scope):** strict optional descriptor, deterministic
   scout/sentry simulation, swept contact/projectiles, capture elimination,
   replay/save authority and equal-board Solo/Versus tests. No public enrollment.
2. **D2b:** registered actor catalogue and shared compiler/Studio authoring,
   explicit on/off copy-on-write projection, diagnostics and greybox encounters.
3. **D2c:** consistent pixel actors, aim/projectile/impact cues, bounded scrap
   decals/audio, cosmetic/reduced-effects settings and player-facing restart/next
   toggle through the shared host. Native/accessibility/flow/playability gates.
4. **D2d:** explicitly versioned Team ownership/simultaneous-contact semantics and
   two-player content qualification; integrate with the Team owner. Until then,
   Team compilation rejects optional combat data, including disabled data.

The existing pressure/variety plan retains all four increments and their release
requirements. A tested engine component is not completion of optional combat.

## Alternatives and choice

- **Selected:** a separate versioned optional patrol descriptor/state within the
  existing classic contract. These actors never enter the retaining-enemy array,
  so they cannot accidentally hold a chamber open. Both roles share movement and
  elimination, while only the sentry adds an attack state machine.
- Reuse bouncers and change contact/retention by inferred artwork or role name:
  rejected. It risks changing historical capture rules and making appearance
  authoritative for damage.
- Purely decorative people that disappear without gameplay effects: insufficient
  for the requested new challenge. Cosmetic alternatives remain separate from
  enabling or disabling actual sentry pressure.

Primary-reference basis remains the [pressure/variety research](2026-09-21-journey-pressure-and-variety.md):
AirXonix separates threat movement domains; Xposed's compact controls and picture
reveal stay central; readable telegraphs support fair response. Exact attack values
below are original test hypotheses, not claims about Reloaded or popularity.

## Runtime descriptor and authority (D2a)

Add opt-in `classic.combatPatrols` with exact keys:

`{ version: 'combat-patrols.v1', enabled: boolean, actors: [...] }`.

Each actor has `id`, `role` (`scout` or `sentry`), cell-centered `x/y`, eight-way
unit heading encoded as two integers in -1..1, `speed`, `turnTicks`; sentries also
have `senseRadius`, `scanTicks`, `openingTicks`, `warningTicks`, `recoveryTicks`,
`restTicks`, `shotSpeed`, `shotLifeTicks`. No unknown keys, inferred defaults or
executable values. Scout descriptors reject sentry-only keys. Dense bounded JSON,
finite units and stable globally unique entity IDs remain mandatory.

Permit only foundation-aware classic levels v5–v8 for this extension, not Legacy
v1–v3 or older classic v4. Descriptor is absent for every historical level.
Versioned optional classic extensions already exist for pressure and timed
bonuses; preserve all existing level/replay/ruleset pairs and old exact hashes.
The descriptor and its complete state participate in authoritative classic
projection, replay and suspended-state verification. Unknown descriptor versions
fail closed. No cosmetic key participates in simulation identity.

At most24 patrols, at most8 sentries, and at most8 live projectiles globally.
All patrol starts require a legal unclaimed footprint (radius0.22), at least
two cells' separation from the craft spawn, no walls/foundations/relay connectors,
and no overlap with other patrols or existing field enemies. Validate this even
when disabled; turning the feature on must not activate invalid content.
Disabled mode creates no patrols, projectiles, attack timers or decals. It retains
the authored descriptor so on/off is explicit authority, not erased history.

Each enabled patrol keeps position, heading, alive/eliminated status, a private
uint32 PRNG state seeded from run seed and stable actor ID, next-turn actor tick,
and (for sentries) attack phase/deadlines/locked aim. Actor order must not change
another actor's random stream. Death keeps a stable record; do not splice the
array during planning. No respawn, drop, life grant, coverage or extra score award.

## Movement, targeting and difficulty

Wander within unclaimed field using the existing swept domain-boundary primitive.
Reflect at walls/reclaimed boundaries; never cross or teleport through them.
At the registered turn interval choose a seeded eight-way heading. Terrain slow
and lethal effects apply to the craft, not these actors. NPC body/trail contact
does not damage the craft. Their future projectile is the only new damage source.

Initial shared authoring recipes for D2b: measured speed1.8 cells/s, turn120 actor
ticks; scout never fires. Sentry sense16 cells, scan30 ticks, opening480 ticks,
warning180 ticks, recovery180 ticks, rest1200 ticks, shot speed8 cells/s,
shot lifetime360 actor ticks. Moving speed uses the existing difficulty multiplier;
only attack rest uses the existing rest multiplier. Warning, recovery, opening,
projectile speed/lifetime and sensing do not get additional difficulty scaling.
No per-map player physics. Runtime validation bounds: speed0.25–8, turn30–1200,
sense4–24, scan12–120, opening240–2400, warning120–480, recovery120–600,
rest360–3600, shot speed4–12 and lifetime120–600, all ticks safe integers.

Sentry cycle: wandering cooldown → stationary locked warning → one shot →
stationary recovery → wandering cooldown. Scan only when the craft is cutting,
within range, outside recovery/grace and line-of-sight crosses only field cells.
Lock the observed craft position when warning begins; do not track subsequent
steering. At firing, require a live target still cutting with the locked ray
unobstructed; returning to reclaimed ground or an intervening capture cancels the
warning into cooldown. Never queue a burst. If projectile capacity is full, skip
the shot and enter recovery. Announce locks through events for D2c's visual cue.

Enemy freeze pauses patrol movement, attack actor clocks, projectiles and their
damage; frozen patrols can still be rammed or captured. Enemy slow scales patrol
and projectile travel, not warning/cooldown clocks. Pausing stops all simulation.
During life recovery, patrols may wander but cannot acquire/fire; cancel existing
warnings and projectiles. Eliminated actors remain eliminated after a life loss.
A fresh attempt reconstructs the same seeded initial population.

## Swept events, capture and ties

Use the classic world's sub-tick horizon, not endpoint-only distance checks.
Plan patrol motion and projectiles, find earliest player contact, projectile
collision, domain boundary or closure, advance all participants to that horizon,
then apply the event in stable-ID order. Bound planning/iteration explicitly;
no zero-time loops, skipped elapsed time or changing unrelated enemy plans.

- Ram: exposed craft contact with a live patrol eliminates that patrol once.
  Returning/ground movement is not an invisible safe-area weapon. Ordinary
  keeper contact and trail collisions remain unchanged.
- Capture: after an accepted closure, any live patrol whose circular footprint
  intersects newly reclaimed cells is eliminated. This includes secured trail,
  filled remote chambers and explicit boss-release fill. It never retains a
  field region or contributes coverage. Domain boundaries are recalculated.
- A projectile is a radius0.10 moving point, travels toward the locked aim without
  homing, and damages only the exposed craft body, not its trail. It disappears
  at the first wall/reclaimed boundary, expiry, owner elimination, recovery or
  terminal completion. At a boundary/body-contact tie the boundary absorbs it.
- Existing fatal collision/timeout priorities remain unchanged. A fatal contact
  at or before a ram/closure wins; no new invulnerability through same-time rams.
  A patrol eliminated by a ram or capture cannot emit a new shot at that same
  timestamp. Already-fired projectile damage wins a same-time elimination tie,
  except the boundary-absorption rule above. Process scheduled shot creation only
  after eliminations at its boundary, never insert damage retroactively.
- Nonfatal ram and capture ties yield one elimination, with capture taking the
  cause when its newly secured cells overlap the patrol. Use stable actor ID ties
  for simultaneous patrols/projectiles. Terminal cleanup creates no new attacks.

Elimination emits stable `combat.eliminated` ID/cause/position/tick data once;
locking, firing, cancellation, projectile expiry and impact have explicit events.
Keep a maximum24 inert elimination records for D2c's nonblocking scrap stamps.
They do not enter collision, fill, scoring or spawning. Reset clears them; restore
reconstructs them exactly. Effects disabled may omit the stamps, never the hazards.

## Shared authoring and player toggle (D2b/D2c requirements)

Register a successor actor catalogue, preserving all v1–v7 recipes byte-for-byte.
The normal mission actor list owns optional-scout/optional-sentry instances; the
compiler routes them into the descriptor rather than `level.enemies`. Studio
CRUD, map markers, pressure inspection, preview/CLI and runtime use that single
projection. An explicit mission combat on/off field accompanies these roles;
no silent unknown-role filtering. Existing noncombat projects remain unchanged.

The on/off projector is copy-on-write, updates affected mission/project editions
and exact identities, and changes no geometry, quota, required objective or
ordinary enemy. On/off attempts and mastery evidence cannot impersonate each
other. Preference persists independently of release version. Mid-attempt changes
require deliberate Restart with combat on/off or apply to the next attempt; do
not erase a live shot invisibly. No extra inter-level menu. Versus uses one agreed
party setting and equal seeds; disagreement blocks start with a clear explanation.
Team remains explicitly rejected until D2d, not silently stripped.

Robot/trooper appearance, muted audio and reduced effects are cosmetic controls,
separate from combat on/off. A small biped/bracket silhouette distinguishes these
removable actors from circles/bolts that still damage on contact. Sentry locked
aim and slow projectile stay visible without color, sound or particles. Use
brief pixel breakup/sparks and inert scrap, never realistic body remains.

## D2a implementation sequence and proof

1. Strict descriptor validation and enabled-only initial state; reject malformed,
   nonfinite, overlapping, unsupported/version-mismatched and over-budget input.
   Verify absence preserves old manifests/checkpoints exactly.
2. Pure seeded movement/attack planners, explicit events and bounded projectiles;
   deterministic state projection. Tests cover timing, locked versus changing
   aim, occlusion, capacity, freeze/slow, pause/recovery and terminal states.
3. Integrate only explicit descriptors into the existing classic world horizon,
   capture and recovery paths. Test swept fast-crossing, wall/body/closure/ram/
   projectile ties, duplicate elimination and disconnected-chamber fill. Verify
   ordinary keeper collisions and capture remain exact historical behavior.
4. Actual-input public-core fixture routes prove contact and capture elimination,
   sentry warning/shot/evasion, no-loss clears and equal independent Versus runs.
   Test exact public replay and suspended restoration, on/off identities and
   tampering. Synthetic collision fixtures stay labeled separately from playable
   route evidence. D2a includes no editor or player-toggle completion claim.
5. Run old capture/impact/foundation/pressure/timed-bonus/transport/Versus cohorts
   on both supported Node versions. Commit only this bounded runtime increment;
   release owner integrates after D2b–D2d and native/human/device gates.

No minimum amount of killing or forced shot waiting gates ordinary completion.
No remote telemetry, retention manipulation, new currency or reward screen.
The unavailable writing-plans helper is replaced by the explicit sequence above;
independent specification review precedes implementation.
