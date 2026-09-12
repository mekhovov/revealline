# v0.4.0 release integrity

Verified on 12 September 2026 using Node 22.22.2 and Python 3.14.4 on macOS. The frozen release at `releases/v0.4.0` passes every archive and reproducibility check below. Full sizes, hashes, commands and results are in [release-integrity.json](release-integrity.json).

The `v0.4.0` tag resolves to `378e7902efdc5f9f585efee5946fb4661d9cfec7`. Its source archive is 107,479,040 bytes and contains 548 regular files. The archive's PAX revision matches the tag; a fresh `git archive` of that exact revision produces identical bytes.

| Artifact         | SHA-256                                                            |
| ---------------- | ------------------------------------------------------------------ |
| Source archive   | `117823941f85f4cca41f2386de8b2682c9dd69e0abe3d0b607904dae61d260a7` |
| Distribution ZIP | `aae68ddb2227e9e7dd6b7b90f9f1ae4c7f9591623e9bd690dacea67989d93cfb` |
| Manifest         | `a172e2bc322096e6699bec01abba42214cf97c200425baba53677ecb2475039d` |

The ZIP is 19,958,374 bytes. All 101 entries pass CRC validation and match the corresponding loose site files byte for byte. Its inventory is exactly the 100 manifest assets plus `manifest.json`. Every manifest size and SHA-256 matches; the inventoried assets total 19,929,272 bytes. The checksum sidecar, game build identity and release record also match. ZIP and source entries were checked for duplicate paths, traversal, links and unsupported entry types; no unexpected loose site files were found.

Reproducibility was tested in `.cache/round-14/rebuild/run-20260912T075452695655Z/`. Only regular source files were extracted into a new directory. The extracted archive's own `scripts/game-cli.mjs` was then invoked with `build --version v0.4.0 --revision 378e7902efdc5f9f585efee5946fb4661d9cfec7`, using a separate output directory and no package installation or working-tree game files. The resulting ZIP, manifest, checksum sidecar and every inventoried asset are byte-identical to the frozen release.

All six prior versions—v0.1.0, v0.1.1, v0.1.2, v0.2.0, v0.2.1 and v0.3.0—also pass source identity, archive SHA-256, ZIP CRC, inventory and individual asset checks. Their source revisions and source/ZIP/manifest digests match the earlier [Round 13 integrity evidence](../round-13/release-integrity.json), as well as their own release records. None was replaced or rebuilt in place.

This verification wrote only cache artifacts and these two evidence files. It establishes archive integrity and reproducibility on this host. Physical iOS/controller tests, native signing and store publication, public-host deployment and human playtesting remain separate checks described in the [public release guide](../../public-release.md).
