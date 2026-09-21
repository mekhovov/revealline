# Optional patrol engine: independent review

**Held engine candidate only.** Reviewed source `851a21005ba9bae3d2846a31b5edf31101c832bd`.
No player enrollment, renderer, Team combat, version or public acceptance is implied.

## Independent execution

The root reviewer ran all four complete combat test files on Node 20.19.5 and
Node 22.22.2: **45/45 pass per runtime**, no skips. The exact-source loader read
165 modules /67 unique bindings in each run. Every loaded byte was independently
compared with the committed source. It never reads the owner's changing worktree.
All production modules are real Git files; no simulation or rules are substituted.

The tests cover strict opt-in schema, deterministic patrol and warning timing,
frozen/slowed behavior, capture/removal, swept collision ties, public-input routes,
equal paired runs, replay, and save/restore during warning and live projectiles.
Synthetic collision arrangements and public-input routes remain distinct evidence.
These are computational checks, not native rendering or physical-input tests.

## Direct historical comparison

A separate Node 22.22.2 trial ran the engine immediately before this change
(`6ff7e3a3`) alongside the candidate. The inputs were three unchanged committed
packs: FPV Arcade r5, Classic Lab and Sentinel Relay, comprising 13 maps, two seeds
and both turning policies: **52 scenarios**.

Both engines used the default scout and the same deterministic sequence of
directions for 1200 ticks per scenario. Every emitted event, each 120-tick checkpoint,
initial checkpoint and final checkpoint matched. This covers 62,400 ticks per engine,
20 captures, 28 failures, 24 respawns, pickups, line impacts, warnings and phase
changes. All 63 module bindings from the two engine namespaces were verified.

These scenarios finished 48 runs still running and 4 respawning: they are deliberate
compatibility probes, **not completed playthroughs**. They cover the named v2/v4
content, not every historical version, map or replay. The owner's larger regression
cohorts remain separate evidence and are not presented as root reruns.

The first comparison attempt could not resolve relative imports from the external
test harness. The loader alone was corrected; no product source was changed. Its
failure log remains retained. See `proof.json`, all TAP records, per-module reads,
`historical-inputs.json` and `historical-comparison.json`. Harness files retain the
exact executed code and local paths; use a new isolated output area for reproduction.

## Source review and remaining gates

No concrete correctness blocker was found in this scoped review of descriptor
validation, stable actor identity, movement, warning clocks, capture/recovery and
the classic-step integration. Optional patrols remain separate from region-retaining
enemies. Elimination emits once and clears owned shots; existing fatal contacts
still win the documented same-time ties. Disabled descriptors create no live actors.

This does not close the enemy-variety requirement. Keep D2b authoring and catalogue,
D2c recognizable actors/aim warnings/projectiles/audio/preferences, and D2d Team
semantics explicit. Never allow invisible actors into player missions or silently
drop unsupported Team combat. Native readability, difficulty and human enjoyment
must be verified after those pieces exist. Reconcile source after PR209, perform
the required complete integration gates, then version, publish and verify the
actual public build before accepting any player-facing delivery.
