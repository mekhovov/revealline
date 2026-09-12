# v0.5.0 release integrity

Verified on 12 September 2026 with Node 22.22.2 and Python 3.14.4 on macOS. The frozen `releases/v0.5.0` archive passes source identity, ZIP CRC, asset inventory, offline metadata and reproducibility checks. Full commands, environment, sizes and digests are recorded in [release-integrity.json](release-integrity.json).

The annotated `v0.5.0` tag peels to `617fc224043945c0fc337c12027aa70e4da33323`, matching the release record and source archive PAX revision. A fresh `git archive` of that commit matches the frozen source archive byte for byte. The archive is 108,984,320 bytes and contains 589 regular files, totaling 108,467,321 extracted bytes. Source and ZIP entries were checked for duplicate or unsafe paths, traversal, links and unsupported entry types.

| Artifact         | SHA-256                                                            |
| ---------------- | ------------------------------------------------------------------ |
| Source archive   | `62decf095cbf4da2bab0fcd29f27480dadd80cbc3f13c3c43b0d90eac5eeaa3b` |
| Distribution ZIP | `2d84e13c9a59b0905131be845a6d4464137ffacc11f9a593f8492c9b4dc5461f` |
| Manifest         | `04a59cc082d242d884c6bc304e54e29101ea8fcdb708a7e2016edd5def2cbfb9` |

The 20,023,487-byte ZIP contains exactly 108 entries: 107 manifest assets plus `manifest.json`. Every entry passes CRC validation and matches its loose site file byte for byte. All manifest sizes and SHA-256 hashes match; the assets total 19,992,280 bytes. The checksum sidecar, build identity and release links match, and no unexpected loose site files are present.

Reproducibility was tested in `.cache/round-15/integrity/v0.5.0-run-20260912T084805475526Z/`. After extracting only regular files into a fresh directory, the archived source's own `scripts/game-cli.mjs` was invoked with `build --version v0.5.0 --revision 617fc224043945c0fc337c12027aa70e4da33323` and a separate output directory. No working-tree game files or package installation were used. The rebuilt ZIP, manifest, checksum sidecar and every inventoried asset are byte-identical to the frozen release.

The offline cache inventory contains 104 files totaling 19,955,837 bytes. Every entry matches the distribution manifest and actual file hash. The service worker embeds the exact `offline-cache.json` configuration and matches the archived worker template with that configuration inserted. Its build ID was independently recomputed from the frozen build identity, worker template and normalized asset bytes:

`82c2c5b7d4e7a166ca919925f84dc6b91d05a0380b0f18bcf6ac8a6ccfdb9955`

All five game HTML pages reference that version/build ID and resolve their worker and scope to this distribution root. The web app manifest starts at `./game/`, scopes to `./`, and references existing icon files. This verifies offline artifacts; browser installation and offline navigation are separate checks.

All eight previous releases remain unchanged: v0.1.0, v0.1.1, v0.1.2, v0.2.0, v0.2.1, v0.3.0, v0.4.0 and v0.4.1. Their source revisions and source/ZIP/manifest hashes match the six-release [Round 13 baseline](../round-13/release-integrity.json) and the separate [v0.4.0](../round-14/release-integrity.json) and [v0.4.1](../round-14/release-v0.4.1-integrity.json) records. All eight also pass fresh CRC, exact inventory and individual asset checks. None was modified or rebuilt in place.

Verification wrote only owned cache artifacts and these two evidence files. No runtime, release, tag or native files were changed, and no publication occurred. Reproducibility on this host does not establish physical controller/iOS support, native signing or store readiness, public-host deployment, or human enjoyment; those remain separate [public release checks](../../public-release.md).
