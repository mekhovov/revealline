# Xonix core v1

This directory implements actual territory gameplay in plain browser/Node ESM. It has no rendering, DOM, asset, storage, audio, network or wall-clock dependency. It does not import the earlier motion lab. The shell owns input devices, display, pause, menus and persistence; the kernel owns all gameplay state.

## API

```js
import {
  createRun, stepRun, getSummary, replayRun, releaseInputs,
  validateLevel, validateClassRecipes, loadoutHash,
  CLASSES, CELL, FIXED_DT, RULESET, TURN_POLICIES
} from './core/index.mjs';

const run = createRun(level, {
  seed: 17,
  turnPolicy: 'immediate', // or 'grid-center'
  classId: 'scout',
  // classRecipes: validated JSON array; defaults to CLASSES
});
stepRun(run, {direction: 'down', boost: false, action: false, pickup: false});
render(run); // read state; never modify it
```

- `validateLevel(level)` and `validateClassRecipes(recipes)` return `{valid, errors}` without modifying inputs. `createRun` throws for invalid data or unknown policy/class. Source level data, nested rules and the selected recipe are copied into the run.
- `createRun` returns one **mutable** owned simulation. `stepRun` returns that same object. A renderer may read it; arbitrary external mutation invalidates replay guarantees. A class/policy change requires a new run.
- `stepRun(run, input, dt = 1/120)` accumulates finite elapsed seconds in `0..10` and consumes fixed `1/120` steps. It does not discard elapsed time. A call with less than one available tick does not process input yet. An unusually large elapsed call should be an intentional simulation catch-up, not a hidden-tab resume.
- `direction` is `up`, `right`, `down`, `left` or `null`. Missing direction means stop. `boost`, `action` and `pickup` are booleans. Actions are **rising-edge** latches; held buttons do not repeat. A shell that produces one-frame actions must retain them until a simulation tick consumes them, then supply a false tick before the next press. Holding gamepad booleans directly also works.
- `events` contains events from the latest `stepRun` call, including all its fixed steps. Later calls replace that array. `won`/`lost` runs cannot change; later calls only clear events. Consume the one `run.completed` event promptly rather than polling it indefinitely.
- Pause means **do not step**. On pause, focus loss or input cancellation, clear physical device holds and call `releaseInputs(run)`; this clears speed, queued turns and action latches without changing time or position. Do not submit stale held commands when resuming.
- `replayRun(level, options, inputs)` returns the final run from **one input per fixed tick**. Record tick inputs, source level revision and options, including custom recipes. Do not treat a render-frame event list as a tick replay. The uint32 seed is retained in identity; authored enemy motion currently uses no randomness. Seeded map generation happens outside this kernel.
- `getSummary` returns a plain snapshot containing ruleset, level/revision, seed, turn policy, class/revision, loadout hash, status, tick/time, lives, score, coverage, counts, medal and objective counts. The loadout hash is an identity checksum, not authentication or an anti-cheat signature.

## Level JSON

```json
{
  "version": "xonix-level.v1",
  "id": "first-cut",
  "revision": "1",
  "name": "First Cut",
  "width": 48,
  "height": 36,
  "spawn": {"x": 24.5, "y": 0.5},
  "walls": [{"x": 10, "y": 10, "w": 8, "h": 2}],
  "enemies": [
    {"id": "field", "type": "bouncer", "x": 37.5, "y": 24.5, "vx": 2.2, "vy": 1.6, "radius": 0.3}
  ],
  "objectives": [{"id": "relay", "x": 8.5, "y": 14.5, "required": true, "hidden": false}],
  "supplies": [{"id": "home", "x": 24.5, "y": 0.5, "radius": 2}],
  "goal": {"coverage": 0.65},
  "rules": {
    "lives": 3, "moveSpeed": 8, "boostMultiplier": 1.5,
    "respawnSeconds": 0.65, "graceSeconds": 1,
    "playerRadius": 0.18, "pointsPerCell": 10,
    "objectivePoints": 500, "timeMedals": [90, 150]
  }
}
```

Positions, lengths and speeds use cells and seconds. The fixed board never changes with viewport size. An integer `(x,y)` denotes the upper-left of a cell; its center is `(x+.5,y+.5)`. Spawn must be an outer-border **cell center**. Both movement policies use the same outer center limits: x `.5..47.5`, y `.5..35.5`.

Walls are nonoverlapping integer rectangles strictly inside the border. Enemies must initially fit outside walls; field enemies must fit in the unclaimed interior. Actor/objective/supply IDs are unique. Arrays can be omitted. Geometry/count/range limits and all supported `rules` fields are checked by `validateLevel`; unsupported rule keys fail. Presentation metadata can be attached to the level but has no gameplay effect.

Public `cells` is a `Uint8Array(48*36)`: `0` field, `1` safe/claimed, `2` permanent wall. The outer one-cell border begins safe. `totalClaimable` counts initial nonwall interior cells. `claimedCount` counts only newly secured interior cells; outer border and walls never enter numerator or denominator. `coverage = claimedCount / totalClaimable`.

## Movement, trail and capture

Immediate input changes cardinal direction immediately. Null input stops immediately. Boost multiplies travel speed only. The player core radius blocks permanent walls; no sprite measurement is consulted.

Grid-center input changes direction only at centers `(n+.5,m+.5)`, including reverse. Between centers, the latest **currently held** direction wins the one-slot buffer. Releasing all directions immediately stops and clears it; an off-center restart follows the retained travel axis to the next center while a direction remains held. The queued turn consumes remaining movement in the same tick. Before leaving a center, the kernel checks the next center for a wall. A blocked route stops at the reachable center and can accept a reverse or perpendicular turn. Recovery grace similarly stops at the safe center. No wall contact silently snaps a moving player backward.

Leaving preexisting safe ground automatically starts a live cut. Movement is continuous, but the authoritative vulnerable trail is the **set of entered 1×1 cells**, exposed in `trail` as `{x,y,index}`. The complete tile becomes vulnerable as soon as it is entered. Render these cells visibly; a thin decorative centerline alone understates the hazard. `trailSegments` retains the continuous path for direction and drawing. Cell ownership is half-open by coordinate flooring; exactly finishing on a safe boundary closes according to travel direction. Sub-epsilon spans caused by floating arithmetic are discarded, avoiding false historical segments at integer boundaries.

Reentering an older live tile fails; continuing within the most recently entered tile is allowed. Exact centerline self-crossing/reversal is additionally checked inside that latest tile, so reversing along a fresh segment is dangerous even before entering a previous tile. Ordinary forward continuation and its adjacent join are ignored. Neither heading animation nor body width modifies this rule.

Returning to a **preexisting safe cell** closes a cut. A wall blocks but never closes it. Enemy/body/lane/self contact is resolved at swept time of impact **before** closure at the same instant. Actor IDs use deterministic code-point ordering for equal-time contact ties. At most one failure or shield recovery occurs per tick.

For surviving closure, secure the live tiles, then flood remaining unclaimed nonwall cells with four-neighbor connectivity from every field enemy's current center. All seeded components remain field; every unseeded component becomes claimed. A border patrol is not a fill seed. Enemies on both sides may yield only the line. No field anchors means all remaining cells are captured by a valid closure. Claimed topology is applied before the rest of the tick's movement.

Each newly claimed cell awards its configured points once. Objectives in claimed cells become captured/revealed and award points once, regardless of whether they were previously hidden. Supplies use proximity and the separate pickup action; enclosure does not grant an implicit refill. Winning requires coverage **and** all required objectives. There is no hard countdown. Gold requires the gold time and no lost lives; silver requires the silver time; any other clear receives bronze.

Failure cancels the unfinished cut, preserves already claimed cells and score, and removes one life. During the visible recovery interval enemies continue moving. The player then returns to authored spawn with brief grace; grace blocks new cuts and contact but allows travel along safe ground. A still-held direction can move again after recovery/grace, so a shell may choose to clear holds on `player.failed`. At zero lives the run ends once. A win ends once at its exact closure time.

## Actors

| Type | Data and implemented behavior |
|---|---|
| `bouncer` | `x,y,vx,vy,radius?` (radius default `.25`). Continuous movement reflects off committed safe cells/walls using swept expanded-rectangle contacts. It contacts the live tiles and the exposed player. Corners conservatively use the expanded rectangle footprint. |
| `border-patrol` | `x,y,speed?,clockwise?,radius?`; authored position on the outer center-line. Default speed4, clockwise. It traverses the fixed original perimeter, can contact the player on safe border and is excluded from fill seeding. It does not follow newly claimed contours. |
| `lane-boss` | Stationary field seed at `x,y`, `axis` horizontal/vertical, optional `period`6, `warningSeconds`1.5, `activeSeconds`.7, `laneWidth`1.2, `radius`.25. First warning starts at2seconds. Each warning records the player's row/column (clamped to interior centers), then activates that entire interior lane, then rests. `bossPhase` is `idle`, `warning` or `active`; `lane` is a number. Safe ground is not damaged; an active lane can contact exposed player/live tiles. Stun suppresses lane damage while its phase clock continues. |

Enemies do not damage each other. Boss phase and field inclusion/status are evaluated on fixed-tick boundaries; actor travel and trail/body contact within each interval are swept. Field statuses affect movement when the enemy is inside the field at that tick boundary. This is an explicit arcade rule, not continuous fluid or real vehicle physics.

## Ability recipes and identity

The default five `CLASSES` entries are plain data. `createRun(...,{classRecipes})` accepts a validated JSON **array** so a shell can load its own content file. Each recipe contains `id`, `revision`, `label`, `description`, `primitive`, `capacity`, `cooldown`, `duration`, `radius`, and `slowFactor` only for `slow-field`. Unknown fields/effects fail. `scan`/`shield` have capacity0; fields have capacity1..8; shield radius must be0. New primitives require a code implementation and tests.

| Class | Primitive | Effect |
|---|---|---|
| `scout` | `scan` | Reveals hidden objectives within radius permanently; `scanUntil` exposes a temporary trajectory-information window to the renderer. It does **not** slow enemies. |
| `bomber` | `stun-field` | Pick up one charge at a supply pad and place a temporary local field; eligible field enemies stop while inside. |
| `carrier` | `stun-field` | Same effect with two-charge carrying capacity. |
| `interceptor` | `shield` | One enemy or lane contact within the short window is absorbed. The live cut is discarded; recovery returns to spawn without losing a life. This cannot secure an occupied cut or teleport into a capture. Self-contact is never absorbed. |
| `trapper` | `slow-field` | Pick up one charge and place a local field; eligible field enemies move at its declared speed factor. |

Fields do not affect border patrols. Ammunition starts empty. Pickup fills capacity only near a pad and never resets cooldown. Pickup is processed before action when both edges occur in the same tick, so a deliberate simultaneous pickup/drop works. Held action cannot repeatedly fire after cooldown. Action and pickup are rejected during recovery. Recovery clears active fields and consumes an active shield; timers otherwise use simulation time. Effects and collection/cosmetic ownership are unrelated.

The selected recipe is copied into the run. `classRevision` is its declared revision. `loadoutHash(recipe)` fingerprints the ordered gameplay fields, including ID/revision but excluding label/description. A changed capacity therefore changes result identity even if the author forgets a revision bump. A persistence boundary must compare these fields and separate custom practice results from campaign results; this kernel does not authenticate user-edited data or decide unlock policy.

Dash, projectiles, net capture, fiber equipment, ten-way class progression, slow/lethal terrain and the old lab's other toys are **not integrated** here. Their earlier design studies do not silently become territory rules. This first registry implements only the five rows above.

## Events and verification

Current events are `cut.started`, `cut.closed`, `cells.claimed` (indices/coverage), `objective.captured` (id), `player.failed` (cause/actorId/lives), `player.respawned`, `shield.absorbed`, `pickup.collected` (id/ammo), `ability.used` (primitive/ammo), `ability.rejected` (reason), `boss.warning` (axis/lane/activeAt), and once `run.completed` (summary fields). Every event includes tick and simulation time. There is no collection reward or economy event in the kernel.

Run `node --test game/test/core-*.test.mjs` from the repository root. The suite covers enemy-seeded sides/pockets/no anchors, denominator and objective scoring, real campaign straight cuts and floating boundaries across speeds, closure-contact ties, stopped-trail danger, self reversal, lives/terminal idempotence, permanent walls and grid escape, release/buffer behavior, 10–240 render FPS agreement, tick replay, pause, validated recipes/identity, ammo/cooldown/stun/slow/shield, boss warning and art independence. The actual campaign opening is an integration fixture; the rest uses authored small deterministic test scenarios. Browser/device control, presentation and persistent progress are separate shell checks.
