# First Light R3 — travelling trail impacts

This is a separate edition of the three First Light R2 missions. It retains the original 72×36 geometry, 65/75/85% targets, enemies, terrain, pickups, capture-stop rule and exact three original picture data URLs. It changes the pack/campaign/level identities and adds `classic.lineImpact: { "version": "line-impact.v1", "speed": 24 }`. These are reused rewards, not three newly authored pictures.

Pack `fpv-arcade-r3` version `3.0.0` contains campaign `fpv-first-light-r3` revision `3`, with `orchard-window`, `split-courtyard` and `night-signal` at revision `3`. It uses `xonix-pack.v5`, `xonix-level.v4`, `xonix-core.v5` and `xonix-replay.v6`. Its Standard campaign key is `fpv-first-light-r3/3/73b6b5aed8595174`; derived Gentle contexts remain separate. No earlier edition or proof is rewritten.

Run `node authoring/library/fpv-arcade-r3/build.mjs` to compare the checked-in pack to its exact, hash-pinned R2 source. `--write` creates an absent output only. The source pictures remain in [the original source directory](../fpv-arcade/backgrounds/); the [new pack](../../../game/content/packs/fpv-arcade-r3.json) embeds their same bytes through the existing image schema.

## Mechanic contract

A qualifying enemy contact with an unfinished line seeds two fronts at the first trail contact. One travels toward the departure point and expires there; the other follows the actual line, including bends and subsequent growth, toward the player. Each actor can seed once per cut, with a maximum of 48 fronts from the existing 24-actor bound. Speed is in board cells per second. The descriptor accepts 4–60; this edition selects 24. That is our authored timing, not a measured XPOSED timing.

The player loses a life only when a front reaches the player. A successful closure cancels every front, including an exact closure/arrival tie. Direct enemy-body, direct lane, self-contact, terrain and timer failures retain their existing priority and behavior. A shield can absorb a front arrival under the existing trail-failure rule. Global enemy freeze prevents new enemy movement/contacts but does not stop an already travelling front. Recovery and terminal completion clear fronts. Simulation pause advances no clocks; replay and saved-run reconstruction retain exact front state.

The optional descriptor is absent from older definitions. Their normalized identities, state shape and checkpoint projection remain unchanged. This implements the requested two-direction travelling-strike behavior; retained research does not establish every Reloaded contact/timing detail.

## Legal routes and the original demonstration

Run `node scripts/verify-fpv-r3.mjs` for the [new proof](../../../game/replays/fpv-arcade-r3-routes.json). It independently replays all twelve Scout wins: three maps × Standard/Gentle × Immediate/Grid. These command recipes come from the retained R2 proof and avoid enemy trail contacts. They establish continued solvability, not a human difficulty or fun judgment. Every nonterminal capture is followed by one released tick and a fresh deliberate direction. Full summaries, checkpoints and observed event counts must match.

The separately importable [Race the impact scenario](../../../game/content/scenarios/line-impact-demo.json) demonstrates the feature with ordinary input. Import the complete scenario in Playground, use Scout, and start Down:

- With Boost, the cut closes at tick 276 (2.30 seconds). Both fronts were created, the departure front expired, and closure cancels the remaining front. The result is a 50% win with one life.
- Without Boost, the chasing front arrives during tick 292 (about 2.43 seconds), producing an `enemy-trail` loss. The player does not lose at initial trail contact.

Both cases are verified under both turn policies. The demonstration is an original geometry/timing test, not a copied reference map. The machine proofs use public core inputs and replay verification; they do not patch positions, time, health, territory or awards. The Node pack/scenario transport checks supply image dimensions from exact original headers and do not claim browser pixel decoding or physical-device input acceptance.

## Storage and offline boundaries

The existing pack formats embed complete images. All nine indexed packs together normalize to 57,606,330 bytes, above the unchanged 48 MiB installed-library limit. Public installation correctly rejects that combination. A player who has all eight prior packs must explicitly remove at least one older illustrated edition before installing R3. Removing R1 or R2 suffices; there is no automatic eviction or limit increase in this source.

Offline precaching and installed-library storage are different budgets. The build configuration explicitly declares the R1 `fpv-arcade.json` source pack optional; it remains in the shipped site, manifest and download ZIP, while the core offline cache excludes it. Already-installed packs are restored from their complete IndexedDB JSON and selected before a bundled-source fetch; an uninstalled optional pack requires an available source. Offline preparation and verification disclose the optional pack. The 64 MiB core-cache cap and 48 MiB installed-library cap remain unchanged.
