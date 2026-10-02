# Lossless current-picture catalogue compaction

The community edition crossed its unchanged 64 MiB budget on main. This repair
stores the generated picture-owner catalogue as private compact rows and
recreates the existing public objects. No content, image, guard, release version
or publication rule is removed or changed.

After Neon #883 merged as `ba598ca65`, the authoritative inventory contains 209
owners: the original 155 plus 54 new Neon owners. Both current pictures and art
locators now include the complete inventory. Every original picture and full
locator object remains identical; the 56 FPV fingerprints are unchanged. Existing
inventory-count assertions are maintained; no unit coverage is added.

Four private dictionaries share campaign keys, themes, dimension pairs and exact
label prefixes. The public objects keep their order, strings, owner properties,
independent dimensions arrays and shallow array freeze. The owner module is
25,369 bytes, saving 11,118 bytes against complete 209-row plain tuples. The
largest ordinary edition is 67,103,443 bytes / 824 files, with 5,421 bytes of
headroom. Continued growth still requires normal capacity checks.

The source of truth remains the authored catalogues used by
`inventoryCurrentPictures()`. When their picture membership changes, run:

```sh
node scripts/generate-current-pictures.mjs --write
node scripts/generate-current-pictures.mjs --check
```

Run this before regenerating current art locators or picture baselines. Those
existing commands consume the exported objects and do not overwrite this module.
Do not edit positional rows by hand. The generator preserves repository formatting.

`evidence/picture-catalogue-capacity-neon.json` records all 18 ordinary production
compiles from the merged source, exact 209-owner equality, original 155-owner and
locator preservation, generator stability, unchanged FPV fingerprints and the two
existing inventory assertions. An independent review also exercised Unicode,
multiple/absent label separators and independent dimension mutation. The art
locator snapshot grows to 1,705,741 bytes because Neon contributes geometry
metadata; it remains outside the company runtime closure but is part of default
site sizing. No original image bytes are embedded by this repair.

Earlier receipts `picture-catalogue-capacity.json` and
`picture-catalogue-capacity-package.json` retain the historical 155-owner audit
and frozen candidate `11b3d9e438104f641ee98f95abcaef9f0a6a333e`. They do not qualify
the newer Neon inventory. Updated frozen-package and default-inspection evidence
is recorded separately after the new source is committed. Protected CI/review
and deployment are still required; no browser/device acceptance is implied.

Frozen candidate `9cb659d3cde6efb0275ec28f4ffedc6d8371e6f0` passes normal
committed-input, ZIP member, presentation and admission checks for the formerly
failing community edition, including two byte-identical builds. See
`evidence/picture-catalogue-capacity-neon-package.json`. Default inspection also
verifies all included inputs and available committed source, with a 989,957,084-byte
payload including its manifest; see the adjacent default-inspection summary.
This is one ordinary preparation, not a complete hosted Pages or native package
qualification. Its report explicitly lists the excluded hosted components.

The first local archive write exhausted disk space and cleaned its temporary
output. Obsolete reproducible FPV verification copies were removed, preserving
source, committed evidence, handoffs and normal player builds; the unchanged
candidate then passed. Ignored authoring dependencies were temporarily parked
and restored around qualification without changing source eligibility rules.
The current #963 PR remains subject to exact-head CI, review and deployment.
