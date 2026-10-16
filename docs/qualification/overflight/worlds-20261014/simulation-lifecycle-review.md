# Simulation and renderer lifecycle evidence

These checks ran against working sources based on `29e3bd4a831834c55b8ecf14a204b14784252f38`. The JSON files contain exact SHA-256 source bindings, settings and environment details. They do not qualify the specified Iris Xe laptop or a physical gamepad/phone.

| Check | Result | Evidence boundary |
|---|---|---|
| Reference fixture: 1,500 simulated / 700 visible | 900 simulated seconds / 54,000 fixed steps passed, then ten deterministic retries | Accelerated Node execution. `worlds.mjs` was reformatted during the first run, so before/after source bindings are retained and `sourceStable` is false. |
| Stress fixture: 2,500 / 1,200 | 150 simulated seconds / 9,000 fixed steps passed, then ten deterministic retries | Clean rerun has stable source bindings. No rendered-frame or GPU claim. |
| Raid reference: 403 / 200 | 900 simulated seconds / 54,000 fixed steps passed, then ten deterministic retries | Clean rerun has stable source bindings. All authored sectors are activated by the technical fixture. |
| Renderer, terrain, state and cache suite | 51/51 tests passed | Mock Phaser/canvas renderer, actual deterministic simulation rules. |
| Ten renderer lifecycles | Passed across the three worlds, reference/stress populations, 512/2048 texture limits | Mock context events, retained source routing and disposal; actual browser restoration remains a separate native check. |

The simulation checks verify pool conservation, unique free slots and enemy IDs, finite actor positions, exact controlled populations and identical same-seed fresh-run states. The fixture deliberately recycles enemies and suppresses ordinary victory/draft flow; it establishes stability of this controlled workload, not campaign balance.

The renderer suite verifies that every visible actor is submitted, accepted enemy images and sprite-animation clips are prepared once, authored clip durations are respected, native upgrade previews reuse those frames, custom world materials/props are baked once, reduced effects preserve gameplay, and every retained canvas is cleared on disposal. Raw diagnostics retain timing samples and bounded atlas page summaries; full duplicated frame inventories are omitted.

The cache regression confirms that a second due reward encounter waits while the first guard group remains locked. Opening the first allows the next group without consuming either reward. Legacy authored rules keep their previous timing.

Native completed-render trials and any wall-clock browser soak are recorded separately by the native-review owner. The accelerated 900-second runs here are **not** a 15-minute browser/GPU soak. External hardware and player trials remain skipped, as previously agreed.

Reproduce a simulation check with:

```sh
node scripts/qualify-overflight-world-lifecycle.mjs --fixture raid-reference --seconds 900 --world freight-depot --output /tmp/overflight-raid-soak.json
```

Use `reference` or `stress` for the shared horde fixtures. Run native timing trials separately from these CPU-heavy scripts and from video capture.
