# v0.4.1 release integrity

Verified on 12 September 2026 using Node 22.22.2 and Python 3.14.4 on macOS. The frozen release at `releases/v0.4.1` passes all checks below. Exact commands, sizes and results are in [release-v0.4.1-integrity.json](release-v0.4.1-integrity.json). The earlier [v0.4.0 evidence](integrity-notes.md) remains separate and unchanged.

The `v0.4.1` tag resolves to `42dc21f65f666036706d57c6f1054a37967f367b`. Its 107,622,400-byte source archive contains 556 regular files. Its PAX revision matches the tag, and a fresh `git archive` of that revision produces identical bytes.

| Artifact         | SHA-256                                                            |
| ---------------- | ------------------------------------------------------------------ |
| Source archive   | `b70d0db44b56ae828fa349bc90bda82484978f70b06d74e0ab39a5573723c7ef` |
| Distribution ZIP | `d14374c2660b858f7094a7f4d6b3e0e2327bb407a3b033db0743ee090449a77b` |
| Manifest         | `410926ada19bb7f6dc1795cfc54d2f97eac6a707e0df84f55852d8de13ce0cc0` |

The ZIP is 19,958,421 bytes. All 101 entries pass CRC validation and match their loose site files byte for byte. Its inventory is exactly the 100 manifest assets plus `manifest.json`; every asset's size and SHA-256 matches, totaling 19,929,319 bytes. The checksum sidecar, release record and game build identity also match. ZIP and source entries were checked for duplicate paths, traversal, links and unsupported entry types, and the site has no unexpected loose files.

Reproducibility was tested in `.cache/round-14/rebuild/v0.4.1-run-20260912T080240695070Z/`. Regular source files were extracted into a new directory, then that archive's own `scripts/game-cli.mjs` was run with `build --version v0.4.1 --revision 42dc21f65f666036706d57c6f1054a37967f367b` and a separate output directory. No package installation or working-tree game files were used. The rebuilt ZIP, manifest, checksum sidecar and every inventoried asset match the frozen release byte for byte.

All seven prior releases pass the same archive identity, manifest asset, ZIP CRC and inventory checks. Versions v0.1.0 through v0.3.0 retain the source/ZIP/manifest digests recorded in [Round 13](../round-13/release-integrity.json). Version v0.4.0 retains the digests in its [Round 14 record](release-integrity.json). Baseline document hashes are recorded in this release's JSON evidence. No earlier release was modified or rebuilt in place.

Only cache artifacts and these two new evidence files were written. These checks establish archive integrity and reproducibility on this host; they do not certify physical devices, native signing or stores, public deployment, or human enjoyment. Those remain separate [public release checks](../../public-release.md).
