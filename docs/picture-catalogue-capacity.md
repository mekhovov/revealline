# Lossless current-picture catalogue compaction

The community edition crossed its unchanged 64 MiB budget by 6,014 bytes on
main `e48adf318`. This repair stores the generated picture-owner catalogue as
private compact rows and recreates the existing public objects. All 155 records,
labels, identities, dimensions, owner fields, ordering and shallow array freezing
remain identical. No content, image, guard, release version or publication rule
is removed or changed. The module shrinks by 22,377 bytes.

The source of truth remains the authored catalogues used by
`inventoryCurrentPictures()`. When their picture membership changes, run:

```sh
node scripts/generate-current-pictures.mjs --write
node scripts/generate-current-pictures.mjs --check
```

Run this before regenerating current art locators or picture baselines. Those
existing commands read the exported objects and do not overwrite this module.
Do not edit positional rows by hand. The generator preserves repository formatting.

`evidence/picture-catalogue-capacity.json` records the read-only proposal audit:
all 18 ordinary production compiles pass, all ordered values match the old
module and regenerated inventory, and formatting is stable. The largest edition
has 16,363 bytes of headroom; continued content growth still needs ordinary
capacity checks. Frozen committed-input/ZIP admission is a separate receipt.
This introduces no unit-test coverage or new browser/device qualification.
