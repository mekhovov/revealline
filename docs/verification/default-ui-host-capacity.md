# Default UI host capacity repair

The preliminary production preparation after integrating main reported **1,349 core files / 67,327,209 bytes**, exceeding the unchanged 67,108,864-byte core limit by **218,345 bytes**. This measurement used mutable working-tree source and candidate version `v0.143.0`; it is a capacity finding, not a committed-source release receipt.

`scripts/default-runtime-metadata.mjs` now applies the existing Company whitespace projector to twenty additional explicitly named UI hosts. The existing `game/app.mjs` projection remains. The projector compares the complete AST, exact lexical tokens, exact comments and every line terminator before accepting an emitted copy. Source-mapped modules remain byte-exact. Canonical repository files, artwork metadata, gameplay recipes, historical records and package limits are unchanged.

Direct production projection of the then-current host bytes saved **279,653 additional bytes**. This would leave approximately **61 KB** relative to the preliminary core inventory; the exact final inventory must be regenerated from the committed source with the selected release version and all final changes. These measurements do not claim the final build passed.

| Additional distribution host              | Bytes saved |
| ----------------------------------------- | ----------: |
| `game/couch/relay-rescue.mjs`             |      56,312 |
| `game/couch/couch.mjs`                    |      40,546 |
| `game/ui/soundtrack-panel.mjs`            |      30,168 |
| `game/ui/library-panel.mjs`               |      16,561 |
| `game/ui/soundtrack-player.mjs`           |      12,777 |
| `game/couch/coop-view.mjs`                |      11,279 |
| `game/ui/optional-chapters-panel.mjs`     |      10,951 |
| `game/ui/render.mjs`                      |      10,940 |
| `game/ui/controller-navigation.mjs`       |       9,244 |
| `game/snake/classic-app.mjs`              |       9,069 |
| `game/ui/mission-library-chooser.mjs`     |       8,819 |
| `game/ui/actor-presentation.mjs`          |       8,498 |
| `game/ui/edition-rewards.mjs`             |       7,783 |
| `game/ui/audio.mjs`                       |       7,189 |
| `game/ui/still-media-panel.mjs`           |       6,798 |
| `game/studio/studio.mjs`                  |       6,755 |
| `game/ui/classic-view.mjs`                |       6,540 |
| `game/couch/couch-installed-chapters.mjs` |       6,531 |
| `game/ui/demo-host.mjs`                   |       6,494 |
| `game/ui/still-story-panel.mjs`           |       6,399 |

Scoped ESLint and formatting passed. The regression source checks the explicit host boundary, unchanged input buffers, unchanged gameplay/artwork/unreviewed modules, multilingual literals, comments, automatic semicolon insertion, line endings and source-map exclusions. It was authored but **not run**, preserving the automated-suite waiver.

This repair changes only the default distribution's emitted host copies. Company already applies the same projector to its engine closure, so its separate capacity blocker is not resolved by this change. Optional-package limits and public-release qualification remain independent.
