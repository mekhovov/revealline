# Authoring Relay Rescue levels and packs

Relay Rescue has its own working level and pack builder. Choose `coverage` or `stronghold` when creating each level. A pack can contain both styles, and the co-op lobby can open the compiled pack directly. This format uses the shared-board co-op engine; solo levels and `xonix-pack` files have separate schemas and are rejected.

The browser-safe implementation is [recipes.mjs](../../game/coop/recipes.mjs). [build-coop-pack.mjs](../../scripts/build-coop-pack.mjs) is its Node command-line adapter. Both call the same runtime validator and additional objective-access checks. The [starter recipe](starter-pack.recipe.json) reproduces the two built-in revision-2 arenas.

## Create and play

Run from the repository root. Each `--out` must name a new file; the builder refuses to replace an existing file.

```sh
# List the available authored styles.
node scripts/build-coop-pack.mjs --list-templates

# Create an immediately playable one-level pack with either style.
node scripts/build-coop-pack.mjs --template coverage --id my-orchard --name "My Orchard" --out .cache/my-orchard.pack.json
node scripts/build-coop-pack.mjs --template stronghold --id my-yard --name "My Yard" --out .cache/my-yard.pack.json

# Build a mixed pack from explicit recipes, then validate the generated data.
node scripts/build-coop-pack.mjs --source authoring/coop/starter-pack.recipe.json --out .cache/my-relay-starter.pack.json
node scripts/build-coop-pack.mjs --validate .cache/my-relay-starter.pack.json

# Produce a standalone compiled level for engine/authoring use.
node scripts/build-coop-pack.mjs --template stronghold --kind level --out .cache/my-yard.level.json
```

Open **Relay Rescue → Play a created co-op pack** and choose the compiled `.pack.json`. Select its arena, challenge and play style, then start together. Imports stay in memory and do not write progression or solo awards. Use **Return to Relay Rescue** to restore the built-in levels. The browser accepts compiled packs; keep the source recipe separately for future edits. A standalone level can be compiled into a one-level pack by rebuilding its source recipe with `--kind pack`, the default.

Omit `--out` to print compiled JSON without writing a file. `--source` and `--template` are mutually exclusive. A source recipe owns its own metadata; `--id`, `--name` and `--revision` apply only to template creation.

## Level recipe

```json
{
  "version": "revealline-coop-level-recipe.v1",
  "template": "stronghold",
  "id": "orchard-relay",
  "revision": 1,
  "name": "Orchard Relay",
  "encounter": {
    "hunterRecovery": 1.7,
    "hunterWakeStep": 0.6
  }
}
```

Required fields are `version`, `template`, `id`, `revision` and `name`. IDs are 1–80 lowercase letters, digits or hyphens and start with a letter. Names contain 1–100 characters; revisions are positive integers up to 1,000,000.

Optional fields are:

| Field       | Meaning                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `layout`    | Replace complete `spawns`, `walls`, `safeRects`, `enemies` or `strongholds` arrays. Omitted arrays retain their template values.    |
| `rules`     | Override `moveSpeed` or `boostMultiplier` within runtime bounds.                                                                    |
| `encounter` | Override the bounded warning/attack-cycle parameters below. Omitted parameters retain the selected template's explicit values.      |
| `goal`      | Coverage template: `{ "coverage": 0.65 }`. Stronghold template: `{ "cores": ["relay-id"] }`. The goal type must match the template. |

Replacing a stronghold array automatically makes all replacement strongholds required unless `goal` explicitly selects their IDs. Geometry is never copied from a solo map. `layout` cannot override dimensions, player count or engine identity. Generated levels are always 72 × 36 with two authored spawns, and the engine owns a copy when a run starts.

The `coverage` template is an open field. Two mirrored Hunters contest the upper half while two mirrored drifters occupy the lower half. Its default objective is 65% territory. The ordinary boosted opening Join claims only its 70 new trail cells, about 2.94%, because enemies retain both halves.

The `stronghold` template has two mirrored pillars at columns 16–17 and 54–55, rows 14–21. Both upper and lower routes remain open around them. Mirrored anchors at `(23.5, 11.5)` and `(48.5, 11.5)` open a core at `(35.5, 6.5)`. A later capture must claim that core. Hunters approach the flanks from below the anchors; two drifters patrol the core region above them. This keeps the core area contested after the anchor cut. The core occupies one of the two central columns because the even-width board has no central cell. Threats, anchors, pillars and spawns have mirrored approaches.

Neither template begins with a horizontal safe divider. Each has one connected FIELD region and the connected 212-cell safe perimeter. New safe routes are earned by completing cuts. The perimeter's maximum shortest path is 106 cells; distant partners should use capture-based rescue or crawl toward a nearer contact, not assume a quick walk across the map. These structural facts do not establish human difficulty or enjoyment.

## Encounter parameters

| Parameter           | Bounds            | Coverage template              | Stronghold template |
| ------------------- | ----------------- | ------------------------------ | ------------------- |
| `hunterWakeStep`    | 0–1 seconds       | 0.45                           | 0.45                |
| `hunterRecovery`    | 0.8–3 seconds     | 1.4                            | 1.2                 |
| `hunterRange`       | 8–36 cells        | 28                             | 28                  |
| `hunterAttackSpeed` | 6–14 cells/second | 10.5                           | 11                  |
| `hunterCommitMax`   | 0.8–3 seconds     | 2.4                            | 2.4                 |
| `emitterCooldown`   | 2–6 seconds       | 3, unused without a stronghold | 3                   |

Hunter attack speed is separate from patrol velocity. A target must be reachable along its warned path within the commitment duration; increasing range alone cannot manufacture an unreachable warning. Initial wake offsets follow a deterministic geometric order. Difficulty retains its visible warning duration and bounds concurrent Hunter warnings/attacks to one, two or three for Gentle, Standard or Expert. A Hunter cannot change its target point during a committed attack. Recovery is harmless and permits counterplay.

These are authored timing values, not adaptive hidden bonuses. Tune them together with enemy placement and routes, then verify both seats and all intended difficulties. Keep space between Hunters, anchors and the core so their warnings remain readable.

## Pack contract and validation

A source pack uses `revealline-coop-pack-recipe.v1` with `id`, `revision`, `name` and `levels`, an array of explicit level recipes. The compiled result is:

```text
{
  version: "revealline-coop-pack.v1",
  ruleset: "revealline-coop.v3",
  id, revision, name,
  levels: [compiled co-op levels]
}
```

Each compiled level retains `revealline-coop-level.v1`. The pack requires the current co-op ruleset exactly. There are at most 24 unique level IDs and a 1 MiB JSON budget. There are no URLs, executable callbacks, imported media or save/award instructions in the schema. Unknown keys and incompatible solo or future formats fail explicitly.

`createCoopLevelRecipe(template, options)` creates a source recipe. `buildCoopLevel(recipe)` and `buildCoopPack(packRecipe)` return independent compiled data or throw a useful validation error. `validateCoopRecipe(recipe)` and `validateCoopPack(pack)` return `{ valid, errors }` without changing the input.

Runtime validation checks bounded rectangles and enemies, connected initial safe ground, legal spawns, unique objective cells and field placement. Authoring adds objective access: both anchors must be reachable while shielded cores still block movement, and each exposed core must be reachable around walls. These checks reject physically inaccessible objectives; they do not replace a public-input completion route, a real rescue route or paired playtesting.

Revise level and pack revisions whenever their authored data changes. Compiled packs contain complete layouts and timing values; they do not resolve template defaults at play time. Archive the source recipe together with its compiled pack and source revision. A future change to the defaults requires a new recipe contract version, so the same committed version continues to compile deterministically.

## Verification

```sh
node --test game/test/coop-authoring.test.mjs game/test/coop-experiment.test.mjs
node --test game/test/coop-threat-pacing.test.mjs game/test/coop-library.test.mjs
```

The authoring tests cover both templates, mixed-pack round trips, input ownership, geometry and encounter rejection, inaccessible anchors, import boundaries, mirrored hazards, FIELD/SAFE connectivity, two pillar routes, and CLI creation without overwriting. Earlier revision-1 cutting and Yard route proofs are preserved in `game/test/fixtures/coop-prototype.mjs`; their old timings do not qualify these harder revision-2 arenas. Record new public-input clears and rescue evidence against the revised levels before release, then use paired feedback to assess difficulty and cooperation.
