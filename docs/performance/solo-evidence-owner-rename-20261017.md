# Live evidence rename race

The exact `a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4` tooling observation in run [39008793815](https://github.com/mekhovov/revealline/actions/runs/39008793815) remains failed. In the baseline WebKit Retry row, the page crashed during the public replay-export Menu action after both result boundaries had been observed. The common owner also reported an `ENOENT` while inspecting `report.json.partial`, forced cleanup, and found no surviving or ambiguous processes. The receipt does not timestamp the inspection violation. Owned termination following that violation may itself have caused the page-crash symptom; this is one confounded failed observation, not proof of an independent browser defect. The rename race does **not** turn that observation into a pass.

The qualifier writes a temporary report and atomically renames it to `report.json`. Live evidence sizing previously enumerated the temporary filename, then failed if the writer renamed it before `lstat`. A deterministic control using the exact previous function body and real filesystem operations reproduces that `ENOENT` while the completed report remains readable. This used no browser or server.

The prospective correction permits only an enumerated descendant to disappear during the existing live size sampling. It validates the evidence root's type, device and inode before and after the scan. Missing or replaced roots, symlinks, permissions failures, special files and the existing 2,000-entry cap still fail; disappeared names still consume that count. Settled size checks retain their strict default. Final inventory, required report parsing, hashing, command ownership, process cleanup and every deadline remain unchanged. The live scan is a sampled bound, never proof of a complete final inventory.

Four deterministic regression controls cover atomic report rename, disappearing child directories, strict settled mode and missing required reports, missing or replaced roots, permissions errors, symlinks and the file-count limit. The full affected wrapper, worker-closure and baseline group passed **28 tests**, with **4 existing Linux-only owner tests skipped** on this macOS host. Scoped lint and formatting passed. Hosted owner confirmation remains pending; the original failed row is retained without a retry or changed assessment.

Retained local evidence under `.cache/solo-followup/`:

| Evidence                                                                               |   Bytes | SHA-256                                                            |
| -------------------------------------------------------------------------------------- | ------: | ------------------------------------------------------------------ |
| `remote-current-wave-a6eacee2/retry-webkit-retained/artifact.zip` original ZIP         | 694,548 | `d8e1216ed6a906263362a4d453182535c772cd90a995ed9e38ae7adcefbe2a08` |
| `remote-current-wave-a6eacee2/retry-webkit-analysis.json` independent raw reassessment |  19,118 | `7f38a01bf6775c616b900f092e9c4b0082859201df090167606cb148658eb504` |
| `evidence-rename-race/before-function.txt` exact earlier function body                 |     504 | `282ce2552f0a109ef9042db57fc88cfb216e3bd1df62f7e7db098ce01160f460` |
| `evidence-rename-race/before-control.json` reproduced failure                          |     535 | `8dfd468427fdab4e0a5cdcbf4d259b5acb7681d0b1c2267a2ad4b06c1d32c522` |
| `evidence-rename-race/combined-tests-v2.tap` complete affected group                   |   7,723 | `b047c546af1bdc07ba5328f22422bd00bae6e7fe7825066bc47e41f583026308` |

The original artifact is `12091679205`. API identity, outer bytes/hash, ZIP paths/CRC and every extracted member passed bounded readback; the independent assessment matched both failed raw WebKit rows. The candidate row's separate first-frame interruption has a clean owner and is unaffected by this tooling correction.
