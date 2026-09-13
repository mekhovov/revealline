# Xonix authoring prompt library

For applied changes to the playable `game/`, pair these briefs with [Runtime Maintainer](../skills/xonix-runtime-maintainer/SKILL.md), [Expansion Author](../skills/xonix-expansion-author/SKILL.md) and the [actual configuration formats](../../docs/assets-and-configuration.md). The shared CLI has 148 templates. Separate prose guides provide [10 reference-import examples](../skills/xonix-reference-importer/references/import-and-style.md), [10 library/expansion workflow prompts](../../docs/library-and-packs.md) and [four audio/reward prompts](../../docs/audio-and-rewards.md); these are not extra CLI IDs. Legacy drafts, media libraries, motion-lab fixtures, runtime expansions and playable scenarios have different formats; select the target first.

Updated 13 September 2026 · 148 reusable CLI examples across nine catalogs: 56 base, 16 source/asset, 16 animation, 16 character collection, 20 ability/world, 9 native-edition/audio, 6 classic, 3 presentation and 6 enemy workflows. Templates are not executed runs; prose requests are counted separately.

The catalog supports four themed families (its NAVI NETWORK draft direction maps to the playable Spend Network world): **FPV FRONT** (main Ukrainian military theme), **UKRAINE ATLAS**, **1994 FOREVER**, and **NAVI NETWORK**. The same gameplay overlay can sit above pixel-art, flat illustration, painterly or photographic reveal images. Background art never defines collision geometry or actual enemy positions.

Open [catalog.json](catalog.json), the [asset-variation supplement](round-06-asset-variations.md), the [animation supplement](round-07-animation-variants.md), the [character-collection supplement](round-08-character-collections.md), and the [ability/world supplement](round-09-abilities-and-world.md) for the exact prompt text, required references, variables, intended output and variations. The prompts are deliberately specific enough to start useful work; choose one and replace its variables rather than pasting the entire library into an agent.

The shared CLI loads all nine catalogs, including `asset-variant-*`, `animation-*`, `collection-*` and `ability-*` IDs. Use `python3 authoring/prompt.py show ability-03-bomber-pickup-drop` or `list` to browse the complete collection. Local rendering substitutes prompt text; it does not call a model or produce media.

The [eight First Flight prompts](round-26-first-flight.md) cover the working v0.16 optional course: instructional copy, exact capture proofs, recovery, saved-flight handoff, input boundaries, layout, themed proposals and offline release checks. They are prose workflows, not additional CLI templates or completed test results.

For production intake, use the [register and replacement requests](production-intake.md) to select an exact missing slot, preserve source identity and run the existing CLI. These prose requests add no prompt catalog IDs and do not imply generated or approved work.

## Choose the right workflow

| Need                                                                                  | Recommended skill                                     | Start with                                                                                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Installable campaign, registered class variants, per-map art or music recipes         | `xonix-expansion-author` + `xonix-runtime-maintainer` | [Ten applied expansion/save prompts](../../docs/library-and-packs.md) and [playground workflow](../../docs/playground-runtime.md) |
| New family or chapter                                                                 | `xonix-theme-designer`                                | A family `01-theme-bible`, then `shared-14-image-pack`                                                                            |
| New image, hero, enemies, UI concept or key art                                       | `xonix-asset-creator`                                 | A family `02`–`06` or `08`                                                                                                        |
| Change an accepted image without redesigning it                                       | `xonix-asset-creator`                                 | `shared-01-reference-lock`                                                                                                        |
| Preserve a supplied picture or create optional styles                                 | `xonix-background-stylist`                            | `asset-variant-01` through `asset-variant-10`                                                                                     |
| Actual sprite production/export                                                       | `xonix-asset-creator`                                 | `shared-07`, `shared-08`, then `shared-09`                                                                                        |
| Replaceable animation components, motion/UI states and playback review                | `xonix-animation-director`                            | `animation-01`, `animation-02`, then the relevant family/state template and `animation-16`                                        |
| Selectable/earned characters, context rules, cosmetic exchanges and collection review | `xonix-character-collection`                          | `collection-01`, `collection-08`, `collection-09`, then `collection-07` or `collection-12`                                        |
| Gameplay classes, equipment, ability tuning and sourced world-role proposals          | `xonix-ability-designer`                              | `ability-02`, `ability-03`, `ability-04`, then `ability-15`, `ability-18` and `ability-19`                                        |
| New challenges or seeded generation recipe                                            | `xonix-level-designer`                                | `shared-15`, `shared-16`, `shared-17`                                                                                             |
| Music direction and actual audio handoff                                              | `xonix-audio-director`                                | Family `07-soundtrack`, then `shared-21`                                                                                          |
| Complete pack/readability/device review                                               | `xonix-pack-reviewer`                                 | `shared-10`, `shared-12`, `shared-19`, `shared-22`                                                                                |

The kit contains 13 repository-local skills. The game runtime, procedural audio, imported expansion campaigns and viewport fixtures exist; an individual template is still not evidence that its requested output was produced. Inspect the actual target and inputs before execution. Aseprite source projects, complete production sprite atlases, native store packages and network multiplayer must not be assumed.

## Mode is an operational distinction

| Catalog mode      | What it does                                                            | What it does not establish                                               |
| ----------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `image_generate`  | Creates a new image from a resolved text description                    | Exact pixels, measured layout, working animation or production readiness |
| `image_edit`      | Changes an inspected target/reference image with stated locked features | Guaranteed identity retention or pixel-perfect preservation              |
| `text_generate`   | Produces a bible, brief, specification, recipe or content draft         | Actual audio, art, runtime behavior or tested balancing                  |
| `asset_execution` | Requests real import/export/production work against actual files        | Permission to fabricate unavailable outputs or implement the game        |
| `review`          | Inspects actual artifacts and records evidence                          | Unperformed tests, hardware access or assumed passing results            |

For the current built-in image tool, a brand-new image uses the prompt without a reference-image argument. For edits, inspect the target first and supply actual reference paths when all target images have local paths. Otherwise use the smallest recent-image inclusion that contains every target; never provide both reference mechanisms. If targets cannot all be included, obtain the missing image. Follow the active image tool/skill contract if it changes.

A reference belongs to a defined role: **target to edit**, **identity to preserve**, **style-only reference**, **composition to preserve**, or **source for factual details**. A beautiful style reference is not automatically an instruction to copy its character, layout or logo. For stable characters, generate candidates once, select a keeper, then use an edit prompt with that keeper. Repeating a text description alone is a weaker identity lock.

Prompts ask for exactness where helpful, but verification decides whether it was achieved. A generated five-panel storyboard is not an animation. A generated grid of characters is not a validated texture atlas. A soundtrack brief is not music. A device mockup is not responsive UI. Functional text is authored separately from generated imagery.

## Resolve and run one prompt

1. Select by `family`, `asset_type`, `mode` and `intent`.
2. Inspect `reference_requirements`; use actual paths and observed facts.
3. Replace every `{{VARIABLE}}` in `prompt`. The `variables` array lists exactly those tokens.
4. Pick a `variations` entry only if desired. Explicitly replace the affected clause; avoid stacking contradictory art directions.
5. Execute through the selected skill with the appropriate current tool. Save the **resolved prompt**, not just its template ID.
6. Record outputs, inputs, decisions and evidence using [run-record.template.json](run-record.template.json). Move asset status forward only when the corresponding work happened.
7. Review at the actual intended play size, then choose the smallest next edit. Keep accepted source art and numbered revisions.

The catalog's `status: template_not_executed` describes each prompt example. It is separate from an asset's production status in its pack. The actual pack schema owns accepted asset-status values; the run-record template's human-readable stages are workflow notes.

## Apply a runtime expansion

Start from a copy of `game/content/packs/night-shift.json` or `living-threads.json`. Use the [runtime playground](../../docs/playground-runtime.md) to select its campaign/map/theme/classes, preserve its original artwork and music descriptor, and test edits in both steering modes. Signal/hangar brushes and Fiber/Bomber/Impact presets exercise actual supported interactions. **Export map as expansion** makes a new one-map pack; **Export loaded library** preserves the original imported multi-map catalog, not uncommitted editor changes.

Install the resulting `xonix-pack.v1` through the main game's **Library & saves → Expansion packs**, select its campaign and complete a normal attempt. Confirm the full picture, celebration, gallery and local score, then export/re-import the pack and player library. Keep progression testing separate from practice previews. Use [Replay Theater](../../docs/replay-theater.md) to inspect the four verified Fieldcraft examples or an exported normal v3 run, including ability events, class switches and both steering policies. A theater viewing is observational and awards no progression. `xonix-core.v2` supports seven class recipes built from five primitives; `xonix-replay.v3` captures roster-aware class switches. New algorithms, audio-file imports or online services require implementation beyond a JSON prompt. See [replays](../../docs/replays.md) and the [public-release gate](../../docs/public-release.md) for evidence to record.

## Theme and asset recipes

### Add a main-theme winter chapter

Start with `fpv-01-theme-bible`, keeping the blue/yellow quadcopter silhouette stable. Use `shared-14-image-pack` with:

```json
{
  "FAMILY": "fpv-front",
  "CHAPTER": "Winter Signal: fictional invading military vehicles in snowy Ukrainian rural and industrial scenes",
  "REVEAL_STYLE": "deliberate modern pixel art, ivory snow, charcoal vehicles, steel-blue shade and muted rust"
}
```

Then resolve `fpv-02-reveal-art` with `SCENE` set to one chosen scene, such as “a fictional snowy rail siding with invading military trucks and armored vehicles, late afternoon blue shadows.” Replace its default Daybreak palette with the explicit chapter palette. Use `shared-10-contrast-review` when actual composites exist. Bright snow makes a good stress case for player/trail outlines.

### User intent and the current contract take precedence

Templates are starting examples, not constraints on the user. Preserve the requested chapter, medium, image count and level count. If the user requests a watercolor history pack, replace `atlas-02`’s Petrykivka/pixel-art example with that researched period and medium; do not silently turn it back into botanical pixel art. Resolve `shared-04` with `PAINTERLY_MEDIUM = transparent watercolor`. The legacy draft-pack schema records watercolor or gouache as `style: illustration`, with the specific medium in the art brief; it does not accept a made-up `watercolor` style enum.

For legacy draft-pack work, the [authoring contract](../CONTRACT.md) and its registered primitive catalog win over example wording about richer mechanics. That schema records seeds as provenance for materialized grids; it does not execute a generator. Its unsupported medals, modules, pursuers, swept hazards and linked-pair mechanics remain proposals until registered. The playable game has an actual candidate generator, medals, seven class recipes using five primitives, signal regions and hangar switching: consult its [core](../../game/core/README.md) and [configuration guide](../../docs/assets-and-configuration.md) before applying a brief. A stationary illustrated emitter can be a draft-schema capturable marker that clears a modifier or disables tagged enemies, but that does not register the effect in the playable game. Do not add unknown properties to make a prose example appear implemented. `shared-15` takes `LEVEL_COUNT` explicitly.

### Same main picture in four styles

Choose one accepted military reveal picture and inspect it. Run `shared-02-style-pixel`, `shared-03-style-vector`, `shared-04-style-painterly` and `shared-05-style-photo` as four separate edits of that **same original**. Preserve military subjects and composition. Do not chain conversions from one already-converted image to the next. Compare all four under an identical authoritative gameplay fixture; brighter art can use a quiet adaptive underlay without changing mechanics. The photo-style result remains fictional generated art if its source is fictional.

### A specific Ukrainian history pack

Use `shared-13-historical-chapter` with a named region and narrow era. Research first; let museum evidence determine object and architectural details. Generate the image-pack briefs from those notes and use `atlas-02-reveal-art` only after replacing the Petrykivka-specific subject if it is a historical scene. A contemporary Petrykivka adaptation, a Kosiv ceramics chapter and a historical reconstruction are different art briefs.

### Extend the Coupa theme

Use `navi-01-theme-bible` with current official Coupa reference notes, then `shared-17-module-cards` with the actual supported effect catalog. Create a Paper Circuit image pack with `shared-14-image-pack`. The original C-token remains replaceable placeholder art; use `shared-01-reference-lock` when real selected Navi artwork is available. Keep inferred gameplay metaphors distinct from Coupa's documented product behavior.

## Catalog index

Each family has eight examples: theme bible, reveal art, player, enemy family, menu/UI, capture FX, soundtrack brief and promotional art. Shared prompts add production, review, editing, cultural research, challenge authoring and style expansion.

### fpv-front

| ID                   | Mode             | Purpose                                                              |
| -------------------- | ---------------- | -------------------------------------------------------------------- |
| `fpv-01-theme-bible` | `text_generate`  | Establish Daybreak Front as the main visual identity.                |
| `fpv-02-reveal-art`  | `image_generate` | Produce a military reveal-art concept without baked gameplay.        |
| `fpv-03-player`      | `image_generate` | Find a readable original drone silhouette.                           |
| `fpv-04-enemies`     | `image_generate` | Make behavior roles distinguishable by shape.                        |
| `fpv-05-ui`          | `image_generate` | Explore a field-controller shell around a legible board.             |
| `fpv-06-capture-fx`  | `image_generate` | Storyboard a cut resolving into a Ukrainian-inspired boundary.       |
| `fpv-07-soundtrack`  | `text_generate`  | Give a composer an implementable adaptive score brief.               |
| `fpv-08-promo`       | `image_generate` | Communicate the main fantasy without confusing key art and gameplay. |

### ukraine-atlas

| ID                     | Mode             | Purpose                                                                      |
| ---------------------- | ---------------- | ---------------------------------------------------------------------------- |
| `atlas-01-theme-bible` | `text_generate`  | Build a coherent cultural family with separate referenced traditions.        |
| `atlas-02-reveal-art`  | `image_generate` | Create an original Petrykivka-inspired collectible composition.              |
| `atlas-03-player`      | `image_generate` | Explore bird and stylus avatars with a stable core silhouette.               |
| `atlas-04-enemies`     | `image_generate` | Use abstract hazards that do not depict culture as the enemy.                |
| `atlas-05-ui`          | `image_generate` | Turn the collection into an inviting illustrated atlas.                      |
| `atlas-06-capture-fx`  | `image_generate` | Explore material-specific closure effects while retaining geometric clarity. |
| `atlas-07-soundtrack`  | `text_generate`  | Create varied cultural music briefs without false historical claims.         |
| `atlas-08-promo`       | `image_generate` | Show discovering a living collection.                                        |

### retro-1994

| ID                     | Mode             | Purpose                                                         |
| ---------------------- | ---------------- | --------------------------------------------------------------- |
| `retro-01-theme-bible` | `text_generate`  | Separate three nostalgic eras with an original visual language. |
| `retro-02-reveal-art`  | `image_generate` | Make nostalgia intimate and discoverable.                       |
| `retro-03-player`      | `image_generate` | Create an original memorable arcade cursor.                     |
| `retro-04-enemies`     | `image_generate` | Give abstract glitches readable behavior signatures.            |
| `retro-05-ui`          | `image_generate` | Use a fictional software shelf as the collection interface.     |
| `retro-06-capture-fx`  | `image_generate` | Make a nostalgic but clean score-feedback sequence.             |
| `retro-07-soundtrack`  | `text_generate`  | Specify original tracker nostalgia with adaptive layers.        |
| `retro-08-promo`       | `image_generate` | Create collectible imaginary box art.                           |

### navi-network

| ID                    | Mode             | Purpose                                                          |
| --------------------- | ---------------- | ---------------------------------------------------------------- |
| `navi-01-theme-bible` | `text_generate`  | Make Coupa-inspired value recovery playful and broad.            |
| `navi-02-reveal-art`  | `image_generate` | Reveal a living business network instead of a spreadsheet.       |
| `navi-03-player`      | `image_generate` | Explore a replaceable placeholder with human-friendly character. |
| `navi-04-enemies`     | `image_generate` | Turn spend friction into distinct abstract obstacles.            |
| `navi-05-ui`          | `image_generate` | Create a game interface that feels clear and business-friendly.  |
| `navi-06-capture-fx`  | `image_generate` | Show a connection becoming useful when a region closes.          |
| `navi-07-soundtrack`  | `text_generate`  | Give Coupa-inspired play a warm, confident sound.                |
| `navi-08-promo`       | `image_generate` | Explain value recovery through an inviting illustrated city.     |

### cross-family

| ID                                   | Mode              | Purpose                                                               |
| ------------------------------------ | ----------------- | --------------------------------------------------------------------- |
| `shared-01-reference-lock`           | `image_edit`      | Make one controlled change to an accepted visual.                     |
| `shared-02-style-pixel`              | `image_edit`      | Convert source artwork while preserving its subject.                  |
| `shared-03-style-vector`             | `image_edit`      | Allow clean illustrated image packs behind the same pixel overlay.    |
| `shared-04-style-painterly`          | `image_edit`      | Support painterly reveal packs without muddying the game.             |
| `shared-05-style-photo`              | `image_edit`      | Support photographic or cinematic reveal styling as a separate layer. |
| `shared-06-background-upload`        | `asset_execution` | Turn a supplied picture into a traceable pack candidate.              |
| `shared-07-sprite-state-plan`        | `text_generate`   | Describe states before asking for frames.                             |
| `shared-08-sprite-state-edit`        | `image_edit`      | Explore one animation without redesigning the character.              |
| `shared-09-atlas-handoff`            | `asset_execution` | Export real tagged source art with traceable metadata.                |
| `shared-10-contrast-review`          | `review`          | Test whether varied artwork hides live information.                   |
| `shared-11-device-composition`       | `image_edit`      | Wrap one unchanged game fixture in varied device art.                 |
| `shared-12-device-measurement`       | `review`          | Separate mockup appeal from evidence of responsive layout.            |
| `shared-13-historical-chapter`       | `text_generate`   | Build a specific researched Ukrainian history pack.                   |
| `shared-14-image-pack`               | `text_generate`   | Plan a varied collection with consistent identity.                    |
| `shared-15-challenge-author`         | `text_generate`   | Author compatible challenge variations with explicit dependencies.    |
| `shared-16-generator-recipe`         | `text_generate`   | Specify reproducible generated challenge families.                    |
| `shared-17-module-cards`             | `text_generate`   | Make tactical variation legible across themes.                        |
| `shared-18-menu-state-kit`           | `text_generate`   | Cover complete UI states before generating decorative menus.          |
| `shared-19-localization-review`      | `review`          | Keep Ukrainian text and business terminology readable.                |
| `shared-20-marketing-variants`       | `text_generate`   | Build reusable promotional composition families.                      |
| `shared-21-audio-execution`          | `asset_execution` | Require actual audio tools and real deliverables.                     |
| `shared-22-pack-review`              | `review`          | Check whether an apparently complete theme is actually usable.        |
| `shared-23-comparison-board`         | `image_generate`  | Explore new chapter looks without fragmenting the game identity.      |
| `shared-24-provenance-and-iteration` | `asset_execution` | Make generations reproducible and iterations explainable.             |

## Reference and production notes

The [20 ability/world templates](round-09-abilities-and-world.md) cover reference taxonomy, modular classes, pickup/drop, scan, dash, net/emitter, equipment, actor roles and four-theme remapping. Use [Ability Designer](../skills/xonix-ability-designer/SKILL.md) with the actual [ability definitions](../motion-lab/ability-presets.json) and [lab README](../motion-lab/README.md). Their independent preview format does not extend the content-pack contract. Explicit class/equipment changes may alter declared state; cosmetics cannot. A sourced military reference is not an implemented enemy, and lab target completion is not territory or earned production progress. Read [Round 09 direction](../../docs/round-09-classes-and-world.md), the [reference atlas](../../docs/concepts/round-09-reference-atlas.html), and [executed authoring checks](../evaluations/round-09-authoring-checks.md) for that historical iteration's evidence.

The [16 character-collection templates](round-08-character-collections.md) cover each family, configurable three-blade propellers, non-rotor motion, source-faithful variants, actual asset exchange, context selection, earned fixtures and deeper game-plan review. Use the actual [collection definitions](../motion-lab/collection-presets.json) for IDs and supported scopes. A shared-body trim is a cosmetic variant, not a second produced character image. Those simulated lab rewards are separate from the playable game's real local saves; the fixtures do not prove runtime reward integration. See [Round 08 authoring checks](../evaluations/round-08-authoring-checks.md) for executed package/tool verification.

The [16 animation templates](round-07-animation-variants.md) cover small FPV silhouettes, separate rotors/trails/effects, enemy motion, all four families, terrain variants, UI states, audio-event timing and responsive budgets. Keep compact/microtile, detailed-object and hybrid variants available on identical geometry. A render may react to velocity and direction without changing movement or collision. Use [Animation Director](../skills/xonix-animation-director/SKILL.md) and inspect the [motion lab's actual capabilities](../motion-lab/README.md) before choosing a preview route.

The [Round 07 reference audit](../../docs/research/round-07-reloaded-ui-motion.md) supports a small bright player head, separate live trail, progress-preserving life loss, a speed-medal timer that need not end play, and distinct artwork/results rewards. Fast-repeat options are our design proposals. Read the [current motion direction](../../docs/round-07-motion-and-balance.md) and [executed authoring checks](../evaluations/round-07-authoring-checks.md) for scope and limits. Full artwork on victory must not overwrite the actual captured percentage.

The [live viewport comparison](../../docs/concepts/round-07-device-preview.html) supports visual comparison in a browser. It is not an iPhone emulator and cannot certify native touch, controller response or hardware performance.

See [the researched asset workflow](../../docs/research/round-04-asset-workflow.md) for source-backed recommendations, the asset handoff contract and the distinction between verified tool capabilities and proposed game-design choices.

## Applied live-picture recovery

Use [the seven still-picture requests](media-presentation.md) for saved A after assignment B, first-earned A, removed-pack viewing, missing-original recovery, real native downloads into a fresh origin, shared-v3 ownership and later story design. These are prose workflows, not extra registered CLI IDs. JSON, `.rlmedia` and `.rlsound` carry separate inventories; source implementations and modeled tests do not establish browser/public completion.
