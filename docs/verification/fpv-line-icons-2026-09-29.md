# FPV / LINE icon packaging — 2026-09-29

The new default-game install identity uses the original generated quadcopter mark. The 1254×1254 master and retained original remain byte-identical, SHA-256 `978ac6d8f979558f1f9341d4f92823e92b639d4cf9d8281fdd45f792e3c3682f`. The final contrast-refined transparent 2172×724 wordmark is retained unchanged at 485,216 bytes.

## Required sizes and budgets

| Output                                 |     Bytes | Encoding                                 |
| -------------------------------------- | --------: | ---------------------------------------- |
| Browser 16px                           |       469 | RGB8                                     |
| Browser 32px                           |     1,386 | RGB8                                     |
| Apple touch 180px                      |    29,773 | RGB8                                     |
| Install 192px                          |    33,508 | RGB8                                     |
| Install 512px                          |    82,577 | RGB8 PNG with 6-bit channel quantization |
| iOS 1024px                             |   590,173 | RGB8                                     |
| Each of three iOS 2732px splash slots  | 1,190,122 | RGB8                                     |
| macOS ICNS, seven sizes from 16–1024px |   753,383 | PNG-backed ICNS                          |

Required-size derivation preserves the full composition using nearest-neighbour sampling. The initial 512px PNG was 195,112 bytes. The approved 6-bit channel optimization reduces it below the unchanged **131,072-byte launcher file cap**, with maximum channel error **2/255**. The lower 5-bit option was measured but not used. All other listed PNG sizes retain full RGB8 samples after resizing. No artwork was redrawn, and no Python image editing was used.

The exact recipe, per-file precision, error bounds and SHA-256 values are in [install-icons.json](../../game/ui/art/identity/fpv-line/install-icons.json); native hashes and source provenance are in [provenance.json](../../game/ui/art/identity/fpv-line/provenance.json). The runtime asset ledger admits the wordmark, five small PNGs and two provenance records. Large master/splash files are not dependencies of the edition runtime graph.

## Maskable geometry

[Maskable icons preserve a central circle with radius 40% of the image width](https://web.dev/articles/maskable-icon). For this dark-background mark, the audit measures every pixel whose largest RGB channel exceeds 100; the darker background texture is excluded.

No such pixels fall outside the safe circle in the master, 192px or 512px image. Their maximum radii are respectively **38.460%**, **38.670%** and **38.436%** of image width. At 512px, the measured radius is 196.790px against a 204.8px safe radius. This is an explicit geometry check of the bright mark, not a claim to have tested every operating-system mask.

## Integration and verification

The default web and stable-launcher manifests display **FPV / LINE**, while preserving their existing `id`, `start_url`, scope and update paths. The compatibility SVG embeds the derived 64px bitmap and declares that actual size; larger installs select the dedicated PNGs. Generated support pages and current-entry aliases receive correctly rooted favicon URLs. The offline launcher displays its local icon alongside the textual name. Partner/company icon selection remains separate.

The existing native-art workflow writes the current iOS asset-catalog paths and stable `assets/revealline.icns` path. Native display names and safe executable basenames were updated separately; application IDs, profile directories and stored format identifiers remain unchanged.

```sh
node scripts/brand-icons.mjs --verify
node scripts/native-art.mjs --verify
node --test scripts/brand-icons.test.mjs scripts/native-art.test.mjs scripts/test-pages-current-entry.mjs
node --test scripts/test-offline-publication.mjs scripts/native-cli.test.mjs
node --test --test-name-pattern='packaged offline builds' scripts/test-game-cli.mjs
iconutil --convert iconset --output /private/tmp/fpv-line-icon-validation-20260929.iconset platforms/desktop/assets/revealline.icns
```

The artwork/native/alias suite passed **16/16**; native staging and offline-publication regressions passed **19/19**; the focused complete-build fixture passed **1/1**, including deterministic inventory generation, manifest identity, size caps and source preservation. Apple `iconutil` decoded the new ICNS successfully. ESLint, formatting and diff-whitespace checks passed for the changed infrastructure.

These checks validate the actual generated assets, format derivations and packaging integration. This follow-up has not created another full web distribution, desktop application or iOS application. Existing local preview packages retain their prior branding until deliberately rebuilt; no release, application version, signing or publication was performed here.
