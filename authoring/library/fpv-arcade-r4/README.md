# First Light Arcade R4

R4 is a separate direction-only edition of the three First Light R3 missions. Pack `fpv-arcade-r4` version `4.0.0` contains campaign `fpv-first-light-r4` revision `4`; its Standard key is `fpv-first-light-r4/4/0295a1eae3e180ec`. The three maps keep their IDs with revision `4`. Gentle derives its own execution key. Earlier editions, replay inputs, saved runs and picture files remain unchanged.

Each level explicitly declares `classic.arcadeActions: { "version": "arcade-actions.v1" }`. The core ignores manual ability, supply-pickup and Boost commands before processing the tick, including when commands arrive through replay or another input adapter. Movement and class switching retain their ordinary contracts. The R4 campaign offers Scout only and has no hangars, objectives or supply pads; it adds no periodic Scan or invented automatic ability. Authored extra-life, speed, slow and freeze pickups still activate through swept player contact.

Cruise speed is authored as 15 cells per second with a Boost multiplier of 1. This matches R3's 12-cell speed with its continuously held 1.25× Boost. Other board rules, enemy timing, terrain, targets, contact pickups and travelling line impacts remain the R3 definitions. Closing a cut still stops movement and requires a fresh direction. The three picture rewards reuse the exact original [source PNGs](../fpv-arcade/backgrounds/); they are not new artwork.

The optional policy belongs to the complete validated level identity and classic checkpoint projection. It inserts no default into older levels. Formats remain `xonix-pack.v5`, `xonix-level.v4`, `xonix-core.v5` and `xonix-replay.v6`. Framework/Tactical recipes without the descriptor retain their manual actions. For validated levels, [arcadeActionCapabilities](../../../game/core/arcade-actions.mjs) exposes `manualAbility`, `manualPickup` and `manualBoost` to a host without inferring behavior from a chapter name.

## Reproduce

From the repository root, run:

```sh
node authoring/library/fpv-arcade-r4/build.mjs
node scripts/verify-fpv-r4.mjs
node --test game/test/arcade-actions.test.mjs game/test/fpv-r4-playthrough.test.mjs
```

The [builder](build.mjs) compares the [pack](../../../game/content/packs/fpv-arcade-r4.json) to its hash-pinned R3 source. The [verifier](../../../scripts/verify-fpv-r4.mjs) executes the [new proof](../../../game/replays/fpv-arcade-r4-routes.json): twelve real Scout wins, covering all three maps in Standard/Gentle and Immediate/Grid. Its 37,828 ticks contain 334 command segments, including 68 one-tick releases. Every command contains only a direction. Full outcomes, checkpoints and event counts are recomputed; prior boosted time, score, lives and coverage must match. Generation with `--write` creates an absent output only.

The focused tests also cover all seven framework loadouts, four automatic contact pickups, malformed descriptors, untrusted/tampered proof inputs, pack/scenario/library roundtrips and an actual Gentle queued-turn save/restore. Node image checks inspect exact original headers; these tests do not establish browser decoding, physical input quality or human difficulty. Catalog allocation and optional downloads have separate integration checks. The 48 MiB installed-library and 64 MiB core offline-cache budgets are unchanged; adding R4 does not automatically evict an installed older edition.
