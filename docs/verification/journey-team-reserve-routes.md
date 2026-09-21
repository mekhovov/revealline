# Team reserve-taking route qualification

Successor to [Team timed route qualification](journey-team-timed-qualification.md).
This is deterministic feasibility evidence for the unchanged Depot dash greybox,
not new released content, human balance acceptance or completion of P02/P14.

## What is demonstrated

Three fresh public-input logs, one per preset, each run with both seat assignments
and joint cuts on/off: **12 no-loss shared clears**. Each pilot makes at least two
real return closures. All collect exactly one optional shared reserve while the
partner is cutting, followed by a real partner return. No positions, pickups,
effects, lives or enemy states are injected; neutral braking is rejected.

| Preset   | Clear seconds | Reserve contact tick | Reserves | Both-idle ticks |
| -------- | ------------- | -------------------- | -------- | --------------- |
| Gentle   | 25.892        | 1042                 | 4 → 5    | 0               |
| Standard | 28.55         | 2902                 | 2 → 3    | 17              |
| Expert   | 17.492        | 1042                 | 1 → 2    | 6               |

All collect the seed-1 reserve at (52.5, 7.5). Gentle and Expert collect speed
first, then the reserve from its first appearance at tick 959. Standard collects
only the reserve: its first eligible announcement is later, at tick 1799, and
appearance at tick 1919. Each announcement lasts the same 120 ticks and contact
precedes the 1200-tick availability deadline. The incidental both-idle ticks are
retained rather than described as uninterrupted motion.

Standard additionally proves enclosure is not collection. At the public log's
tick-2856 checkpoint, the visible reserve is on reclaimed ground, remains present,
and has granted nothing. Later contact grants exactly one reserve. The route's
speed pickup does expire uncollected, but it does not subsequently collect a
relocated speed pickup. **This is not a visible-miss → relocation → collection
proof.** A delayed first eligible reserve is not a second appearance.

## Verification boundary

`TeamReserveRouteEvidenceV1` pins compiler identities, input segments, exact bonus
events, contact coordinates, reserve balances, stop ticks and state/event hashes.
Thirteen tests repeat all twelve runs, verify the preset/seat/joint matrix,
announcement/availability windows, partner activity and material-before-contact
checkpoint. The helper adds only observations and owned snapshots; historical
runtime state/event hashes are unchanged. These are local deterministic logs,
not an official Team replay or resume format.

All 987 tests in the combined timed/runtime/transport/host/Team route cohort pass
on Node 20.19.5 and 22.22.2. Lint, formatting and diff checks pass. Independent
review repeated the thirteen focused tests on both runtimes and all twelve runs
directly through the engine. It confirmed Standard's reserve is reclaimed at
completed tick 2160 without a grant and collected only at tick 2902.

These are ordinary reserve-taking clears, not stronger rover mastery. No-loss
routes cannot demonstrate that the extra reserve materially helps a human, and
the short optimized Expert clear does not demonstrate adequate difficulty. The
original 16 failed seed/timing probes remain unchanged and unqualified.

## Remaining

- Visible expiry followed by a relocated pickup being collected and a full clear.
- Broader starts, alternate Expert mastery, shortcut/pressure-inversion fixes and
  useful complementary two-human play.
- Actual new-map host/device/controller/accessibility checks and original art.
- Coordinated integration, reviewed PR, immutable version and public Pages audit.

No level, schema, physics, schedule, quota, asset or host enrollment is changed
by this unit. No phase or deployment is claimed complete.
