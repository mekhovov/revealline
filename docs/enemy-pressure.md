# Authored enemy pressure

Working source supports optional, deterministic pressure on selected Classic field enemies. This is an original extension, not a claim that XPOSED uses predictive AI. The [reference audit](research/round-40-pressure-and-presentation.md) separates recorded observations from our recommendations. Pressure is a fixed authored policy, not learning or dynamic difficulty adjustment.

Only `xonix-level.v4` / `xonix-core.v5` accepts `classic.enemyPressure`; it travels through existing `xonix-pack.v5`, `xonix-playground.v5` and `xonix-replay.v6` contracts. Omission leaves the old normalized definition, state and identities unchanged. Opting in creates a different normalized map and campaign identity: use a new authored edition, never modify a frozen R4/R3 recipe or its proof to introduce pressure.

## Exact descriptor

Add this member inside a valid level's `classic` object. The referenced enemy must already exist as a moving `bouncer`; this fragment is not a complete level.

```json
{
  "enemyPressure": {
    "version": "enemy-pressure.v1",
    "actors": [
      {
        "id": "hunter",
        "mode": "trail-pursuit",
        "senseRadius": 16,
        "scanTicks": 60,
        "warningTicks": 90,
        "commitTicks": 144,
        "cooldownTicks": 300,
        "leadTicks": 0
      }
    ]
  }
}
```

All fields are required; unknown keys reject. The list requires **1–8 unique existing bouncer IDs**. Their authored velocity magnitude must be greater than zero and at most 20 cells/second. Pressure does not increase that magnitude. Other enemy roles do not accept this policy.

| Field           | Allowed value                       | Meaning                                                                           |
| --------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| `mode`          | `trail-pursuit` or `head-intercept` | Choose a visible nearby trail point, or predict from the observed player heading. |
| `senseRadius`   | Finite number 4–24                  | Maximum distance to the observed trail point/player when acquiring a target.      |
| `scanTicks`     | Integer 24–240                      | Interval between acquisition attempts while patrolling.                           |
| `warningTicks`  | Integer 36–180                      | Warning duration before route commitment.                                         |
| `commitTicks`   | Integer 60–360                      | Maximum committed duration; reaching the route end can finish earlier.            |
| `cooldownTicks` | Integer 90–600                      | Delay before another acquisition opportunity.                                     |
| `leadTicks`     | Integer 0–60                        | Head-intercept prediction horizon; must be zero for trail pursuit.                |

Tick durations use the **120 Hz actor clock**. Global enemy-freeze stops that clock; enemy-slow changes movement speed without extending the clock. Individual stun suppresses updates while stunned but does not extend these global-clock deadlines. These authored ranges are implementation limits, not measured reference timings or recommended difficulty values.

## Acquisition, commitment and cancellation

Acquisition requires a running, cutting player with a nonempty live trail outside grace. Detection uses local range and an unobstructed FIELD sight segment. Trail pursuit chooses the nearest visible projected point on the existing trail, with deterministic ties. Head interception follows only the observed heading and speed, caps prediction distance at half the sense radius, and stops prediction before blocked ground. It does not read future inputs or update its target when the player subsequently turns.

During warning, the enemy continues ordinary patrol movement. At the deadline it computes a route from its then-current position to the locked target. A direct route must clear the whole enemy footprint. Otherwise bounded FIELD-cell search uses north/east/south/west tie order and compacted waypoints, respecting walls and body clearance. An unreachable or grazing route cancels rather than crossing a wall. The route may end at the target FIELD cell's clear center when the exact target point cannot fit the enemy footprint.

Commitment follows that fixed route at the original velocity magnitude, modified only by existing speed effects. Waypoint arrivals participate in ordinary collision horizons. Route completion or deadline expiry enters cooldown; ordinary movement then continues with the resulting velocity. Closure, recovery, a topology revision or an obstructed route cancels commitment before another pressure steering step. Pressure does not change direct-body collision, cut closure, capture-stop, travelling line-impact or erosion ordering. Existing domain-penetration recovery remains separate.

The read-only runtime state is `run.enemies[n].classic.pressure`: version, phase (`patrol`, `warning`, `committed`, `cooldown`), scan/deadline fields, locked target, route/path index, topology revision, base speed and abort flag. The existing complete Classic checkpoint projection includes this state and descriptor. Save/restore reconstructs it through verified recorded inputs, preserving exact warning/commitment and subsequent continuation; UI code must not patch it.

Events are `pressure.warning`, `pressure.committed`, `pressure.cooldown` and `pressure.cancelled`, with actor ID, mode, tick/time, actor tick, target and deadlines. Cancellation adds a reason. These are presentation facts, not extra gameplay commands. Renderers should use current authoritative actor/target state, keep warning and commitment visually distinct, and preserve essential cues in reduced effects. No cosmetic clock may advance a target or damage event.

## Direction-only chapters and verification

The new working chapter identities are pack `fpv-arcade-r5` / campaign `fpv-pressure-lines` and pack/campaign `fpv-pressure-frontier`, each with three maps. Their source recipes live in the [pressure chapter builder](../authoring/library/fpv-arcade-r5/build.mjs). They opt into the existing `classic.arcadeActions: {"version":"arcade-actions.v1"}` direction-only policy and `rules.stopOnCapture: true`: release does not stop an exposed cut, closure stops it, and a fresh direction continues. Manual equipment/Boost commands cannot bypass the Arcade policy; contact pickups remain available. Old R4/R3 editions stay distinct and unchanged. Current indexing, playable proofs, browser acceptance and release publication require their own completed evidence.

The [focused pressure tests](../game/test/enemy-pressure.test.mjs) cover descriptor rejection/ownership, real long-cut pressure versus two counterplay routes under both turning policies, locked prediction, actual freeze, closure/recovery cancellation and replay/session reconstruction. Explicitly labeled grazing/topology cases use controlled setup states to isolate those boundaries. Historical route checks establish compatibility for their recorded traces, not every possible future input.

For new maps, verify Standard and Gentle legal-input wins separately; record greedy straight-cut controls, warning/contact outcomes and alternative exits. Include ordinary first capture followed by stationary ticks, pause/save/restore and fresh continuation. Never edit cells, lives, enemy positions or awards to manufacture a playable proof. Keep pack/offline budgets unchanged. Solver completion is not human enjoyment; browser clarity, hearing, device comfort and playtest difficulty remain separate acceptance work.
