# Pressure Lines and Frontier Lines

Two original three-map Arcade chapters, authored from the immutable R4 base. Run `node authoring/library/fpv-arcade-r5/build.mjs` to verify exact derivation. `--write` creates absent outputs only. It never replaces an old edition.

Pressure Lines introduces warned pursuit, a locked interceptor and timed lanes. Frontier Lines adds alternating corridors, claimed-ground threats, erosion and crossfire. All use 72×36 Classic boards, direction-only commands, contact powerups, travelling line impacts and stopping after capture. Standard/Gentle and Immediate/Grid + buffer keep independent exact contexts.

The six maps have six distinct **existing owned** reward images: three First Light images, then three Homeward Skies images. This is new level content, not six newly generated illustrations. Each three-image pack remains inside current encoded/decoded artwork limits. The Frontier pack is an optional offline download; all eight current packs fit the 48 MiB installed library, while another archived image-heavy edition can require a deliberate removal. No pack is silently evicted.

[Pressure behavior and authored bounds](../../../docs/enemy-pressure.md) explain sensing, target lock, actor-clock timing, cancellation, replay state and replacement interfaces. [Fresh reference research](../../../docs/research/round-40-pressure-and-presentation.md) separates observed Reloaded roles from our original adaptive extension.

The R5 proof tool records legal routes and checkpoints, not fabricated state. Search failures remain evidence; every advertised chapter/mode must pass before release. Root documentation will link the final proof and browser evidence after those gates complete. Human enjoyment and physical controller/device support are separate qualification results.

## Reproduce the evidence

Run `node scripts/verify-fpv-r5.mjs` for all 24 pinned wins and separate ordinary probes. Run `node --test game/test/fpv-r5-playthrough.test.mjs` to include actual committed-pressure save/restore continuations. `node scripts/verify-packs.mjs` verifies complete indexed historical and new coverage in bounded batches. Earlier proof inputs are not regenerated.

The exported `findRoute` in `search.mjs` searches finite straight, one-bend and U-shaped candidates using real simulation inputs. Set explicit time/cut budgets; retain failure traces. `tryRoute` replays candidate directions in another exact difficulty/steering context and records that context's own capture-release boundaries; it cannot assume a win. `node scripts/verify-fpv-r5.mjs --write-from NEW_CANDIDATE_ROUTES.json` creates an absent proof only after all contexts actually win and match replay state. It refuses to overwrite the published proof.

All 24 shipped winning routes observe actual warning and commitment events. Ten ordinary inward probes capture, ten lose a life, and four are blocked by a wall; their pressure-disabled controls do not prove greater human difficulty. Copper Switchyard requires bent search candidates. All 24 saved-prefix checks reconstruct a live committed pursuit and complete identically after restore. These are correctness and counterplay evidence, not a substitute for player feedback.
