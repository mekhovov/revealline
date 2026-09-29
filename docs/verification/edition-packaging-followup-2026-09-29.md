# Edition compile follow-up — 29 September 2026

All **14/14** editions pass sequential in-memory compilation after the Enemy
Workshop and Retro/Coupa changes. Normal source admission, final file/byte caps,
scene projection and offline-manifest checks remain enabled. No build directory,
archive, native package or installed-offline run was produced.

The checker captured the working tree from 03:11:26.078Z to 03:11:58.961Z with
HEAD `c8a8ef459a0ede7cc329eb7bdf5ae1a20abf219e`. All 835 input files and the six
compiler/checker implementation paths stayed unchanged throughout. Once the
frozen scenery was committed, a separate Git-blob check verified **841/841**
paths against `98577732c03e771fc7af40b969f19de7750bdd86`, by size and SHA-256.
There were no mismatches. Thus this remains a working-tree compile receipt whose
captured runtime/compiler bytes match the named committed source; it is not a
published-build receipt.

## Size and projection

- Largest edition: DroneAid aggregate, stable internal ID
  `droneaid-nl-community`: **668 files / 66,781,145 bytes**.
- **327,719 bytes** remain below the unchanged 64 MiB cap (67,108,864 bytes).
- Each edition grew **6,140 bytes** from the prior receipt. Fourteen captured
  input paths changed: eight new mode images and six existing source/ledger paths.
- All Solo-only edition projections exclude multiplayer scene files and manual
  fixtures. Both new mode families remain available in the default package.
- Across all sequential output maps: 8,494 files / 469,524,072 bytes. These are
  summed logical outputs, not additional disk use or a peak-memory measurement.
- Node 22.22.2; existing version metadata 0.142.3 is not a release allocation.

## Retained receipts

- [Full compile matrix](edition-packaging-followup-2026-09-29.json), including all
  captured input hashes and per-edition byte/file counts. SHA-256 of the original
  receipt: `059be698a27509b890c946331c551f5e59917fe8243aa17f6d865e44cca0623a`.
- [Comparison](edition-packaging-followup-comparison-2026-09-29.json), with exact
  changed inputs and prior/current measurements.
- [Committed-input verification](edition-packaging-followup-committed-2026-09-29.json),
  SHA-256 `c6939506229548321fd493fa9e2b6a79f6b8e0c02b2187ad2ce20feb656d11ff`.
- Original [package-budget correction](edition-packaging-2026-09-29.md) is preserved.

Final aggregate native builds, installed-offline acceptance, physical devices,
and canonical publication/public-byte checks remain open. Limited disk space
was respected by keeping this pass in memory and retaining only small receipts.
