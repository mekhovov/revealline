# P10 Crosswind Array — candidate verification

Local-only work continues from P09 `17825389` on `codex/xposed-journey-p10`.
This is not an accepted release baseline, hosted qualification or a Pages build.
The sole publication coordinator owns the frozen v0.76 sequence; no P09/P10 push,
phase PR, version selection, release mutation, bulk hydration or asset generation
is authorized during that sequence.

## Directional-field contract

`MapDesignV3` / `ResolvedMapV3` explicitly add up to 32 named `speedZones` to the
relay-capable geometry. `MissionDesignV3` / `ResolvedMissionV3` compile through the
same project registry. A zone is a whole-cell interior rectangle with one of four
cardinal arrows. Zones cannot overlap one another, walls, foundations, reserved
gates or slow/lethal terrain. IDs, bounds, own-data safety and budgets are checked
before the definition becomes runtime input. Zone orientation participates in
geometry and simulation identity.

The single `directional-fields.v1` recipe is 1.25× with the arrow, 0.8× against
it and 1× across it. There is no authored strength, force, drift, acceleration
curve, enemy modifier or difficulty-specific handling. The existing movement
policy still owns base cells/second, steering, fixed timestep and input recovery.
Effects operate only in unclaimed marked cells. Reclamation removes the effect;
an erosion reopening restores it from the same authored definition. No scoring,
coverage denominator or field-retention semantics change.

The explicit runtime tuple is `xonix-level.v7`, `xonix-core.v8`,
`xonix-replay.v9`, `fnv1a64-state-v8`. Existing editions reject the new descriptor.
Replay/checkpoint authority includes the directional definition in a new section;
old checkpoint sections are unchanged. Field calculations reuse the existing
continuous cell/path-boundary integration, including a buffered turn's cell center.
No new forced movement or blanket input delay is introduced.

## Verification and remaining boundaries

The seven-file core/map/project/relay regression cohort passes 54/54 on
Node20.19.5 and22.22.2. It covers own-data/geometry boundaries, edition mismatch,
fixed factors, exact entry/exit, with/against/across directions, in-cell Grid +
Buffer turns, idle/stop-on-capture, bonus composition and cap, enemy independence,
public replay and directional tampering. Some planner tests explicitly arrange
positions or ownership to isolate invariants; legal-input capture/replay tests
are separate. Relay editing preserves V3 fields and forks the map, not a downgrade.
All 42 P09 ordinary Solo/equal-race cases remain exact in that cohort.

A separate read-only audit also replayed all 59 P01–P08 original candidate fixtures
on both Node versions. Every simulation identity, final checkpoint, life count,
closure/objective observation and other audit value matches the pre-P10 report
(excluding only the report's source-description label). This is compatibility
evidence, not public enrollment or human qualification.

## Transport, cues and candidate authoring

Explicit `xonix-playground.v8` / `xonix-pack.v8` now preserve the successor level,
fields, foundations and relay links through Studio preview, map import/edit/export,
pack installation and campaign selection. Mismatched edition pairs reject; legacy
equipment mastery stays disabled. Briefing, flight information, craft locator and
existing actor presentation recognize the new ruleset without rewriting it.

One bounded, detached visual projection feeds static outlined arrows in gameplay,
the legacy map editor and Studio. It filters current ownership, so claimed cells
lose their arrows immediately and reopened cells regain them. Glyphs stay inside
their cells and under craft/trail layers, use light/dark shape rather than color
alone, and add no motion or hidden steering. Full-picture victory omits the overlay.
Automated drawing tests are not a substitute for native small-screen readability.

Studio's explicit directional-edition opt-in upgrades only the selected mission
through copy-on-write. Shared controls create, rotate, resize and remove fields,
show the effective fixed factors and reject stale context, overlaps and cancelled
adoption. Removal requires a second activation. Existing relays remain editable;
manual image traces preserve fields and reject overlapping replacement geometry.
Undo/redo uses the existing draft history and autosave/checkpoint path.

The authoring/transport cohort passes 18/18 on both Node versions; the nine-file
shell/pack/briefing/editor/flight-information regression cohort passes 82/82 on
both. The first authoring run exposed an omitted `speedZones` map-edit allowlist
entry. It was corrected, and the original failed run is retained locally rather
than counted as a pass. Scoped lint, formatting and whitespace checks pass.

Native interaction, full Crosswind greyboxes, reference adaptations, original
assets, preset/route/mastery/seed/delay matrices, Team and human acceptance remain
open. Team rejects successor editions rather than silently dropping their rules.
No public Journey selects this work; hosted qualification and release remain open.
