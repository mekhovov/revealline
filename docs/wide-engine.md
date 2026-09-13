# Wide engine contract

Implementation contract accepted 12 September 2026. This foundation adds an explicit 72 × 36 simulation edition; it does not resize or replace existing campaign content.

| Level            | Core            | Replay            | Checkpoint         | Board   |
| ---------------- | --------------- | ----------------- | ------------------ | ------- |
| `xonix-level.v1` | `xonix-core.v2` | `xonix-replay.v3` | `fnv1a64-state-v2` | 48 × 36 |
| `xonix-level.v2` | `xonix-core.v3` | `xonix-replay.v4` | `fnv1a64-state-v3` | 48 × 36 |
| `xonix-level.v3` | `xonix-core.v4` | `xonix-replay.v5` | `fnv1a64-state-v4` | 72 × 36 |

Omitted version requests retain the old defaults. Explicit mismatched pairs and mixed-version campaigns reject. A wide level requires an own `encounter` field: `null` selects ordinary enemies and rules; a validated existing relay-sentinel descriptor selects the staged encounter. Unsupported fields, accessors, malformed descriptors and other dimensions reject before adoption. The maximum trail rule follows the edition's finite interior area; all other rule/class limits and contact ordering remain unchanged.

`geometryForLevel(level)` and `geometryForRun(run)` return a frozen descriptor containing `width`, `height`, `cellCount`, `maxX`, `maxY`, `interiorWidth`, `interiorHeight` and `perimeter`. Public helpers without a run accept optional geometry and retain legacy geometry when omitted. There is no mutable global board size and no added geometry field on legacy runs. Movement, cell indexing, capture fill, enemy contacts, border patrols, hangars and lane attacks use the owning run's dimensions. Interleaved old and wide runs must remain independent.

Wide checkpoints retain the complete existing projection, including width/height and cells, and add the explicit nullable encounter configuration/state section under the new algorithm. Old checkpoint section names, normalized objects, command semantics, summaries and frozen replay bytes remain unchanged. A wide recording is reconstructed from public inputs with the exact new pair; changing dimensions, versions or encounter authority must fail verification.

Pack/scenario v4 are reserved for this wide edition, using the existing bounded data-only import paths. Wide packs require `masteries: []` and wide scenarios require `masteryDefinition: null`; optional mastery observation remains unsupported for this core. The new format explicitly selects the wide core and nullable encounter contract; older formats keep their existing accepted levels. Future media has its own versioned contract and must not silently extend wide v4. No authored pack, session envelope, renderer, host, stored profile or old proof is rewritten by this foundation.

Focused acceptance covers malformed/version boundaries, simultaneous 48/72-column runs, movement and capture beyond column 47, border patrol corners, lane/contact behavior, seven existing abilities, both steering policies, real-input ordinary and staged wide replays, and whole-state checkpoint tampering. Existing core/replay and frozen compatibility suites remain independent oracles. Source tests do not certify wide layout, actual browser rendering, new campaign route quality or physical hardware.
