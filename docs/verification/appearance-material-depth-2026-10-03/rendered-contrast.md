# Captured material contrast

All 361 reading twins passed: 15 theme captures and four high-contrast, enlarged-text, reduced-effects captures, with 19 material/state cases each.

The check samples every unique background RGB in the blank twin’s reading rectangle and compares it with the actual computed label color. Normal text requires 4.5:1, disabled text 3:1, and high-contrast text 7:1. All screenshots are JPEG; passing also requires a 0.2 margin. This measures captured pixels and does not claim lossless renderer output.

No contrast failures, narrow-margin warnings, or decode errors remain. The first sampling attempt encountered temporary disk exhaustion during concurrent package tests; the complete sequential rerun succeeded.

| Capture                    | Lowest contrast relative to its target |     Ratio | Target |
| -------------------------- | -------------------------------------- | --------: | -----: |
| copper-observatory.jpg     | primary                                |  7.5069:1 |  4.5:1 |
| deep-space-hc.jpg          | danger                                 | 11.2166:1 |    7:1 |
| deep-space.jpg             | muted-panel                            |  8.1846:1 |  4.5:1 |
| dnipro-porcelain-hc.jpg    | danger                                 | 11.2166:1 |    7:1 |
| dnipro-porcelain.jpg       | muted-panel                            |  6.2423:1 |  4.5:1 |
| dos.jpg                    | danger                                 |  9.5495:1 |  4.5:1 |
| industrial-workshop-hc.jpg | danger                                 | 11.2166:1 |    7:1 |
| industrial-workshop.jpg    | danger                                 |  6.6777:1 |  4.5:1 |
| legacy.jpg                 | danger                                 |  6.4741:1 |  4.5:1 |
| moonlit-grove.jpg          | muted-panel                            |  7.9740:1 |  4.5:1 |
| neon-ruins.jpg             | danger-hover                           |  7.6200:1 |  4.5:1 |
| obsidian-reliquary.jpg     | danger                                 |  7.1676:1 |  4.5:1 |
| orchard-workshop.jpg       | muted-panel                            |  5.8056:1 |  4.5:1 |
| pocket-lcd.jpg             | muted-panel                            |  5.2867:1 |  4.5:1 |
| sakura-station.jpg         | muted-panel                            |  5.6612:1 |  4.5:1 |
| tryzub.jpg                 | muted-panel                            |  7.8581:1 |  4.5:1 |
| vyshyvanka-hc.jpg          | danger                                 | 11.2166:1 |    7:1 |
| vyshyvanka.jpg             | primary                                |  5.0536:1 |  4.5:1 |
| windows-classic.jpg        | input                                  |  4.9398:1 |  4.5:1 |

Reproduce with the test-only runtime fixture and sampler described in [the fixture guide](../../../game/test/fixtures/appearance-materials.md). Full per-state results, capture hashes, and measurement hashes are in [rendered-contrast.json](./rendered-contrast.json); the successful sampler receipt is [rendered-contrast.log](./rendered-contrast.log).
