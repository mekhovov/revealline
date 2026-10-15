# Pointer continuation evidence

See the [report](../flight-practice-pointer-2026-10-15.md) for source bindings,
claims and remaining gates. All raw JSON/log files are copied byte-for-byte;
archives retain the original complete observer output directories, including
plans, individual cases, source snapshots and baseline failure screenshots.
Archives do not contain the separately retained package ZIPs or credentials.
Absolute `/tmp` and external-volume paths are capture-time provenance.

| File                                     | SHA-256                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `baseline.json`                          | `c6d1d04ced4c8f715899a0c2c6306c59dbd3544268af0a5afd68c334f4e3483b` |
| `baseline-originals.tar.gz`              | `ac074b9a69612e037b37a2eb4eed432ca0357304c329156cec618acfcfee2eb2` |
| `fixed-cleanup-timeout.json`             | `21547d05e3a66f8a6c656936820cb539609eb4057e857787fbd4ecdc4e830433` |
| `fixed-cleanup-timeout-originals.tar.gz` | `0333026580fb37ea8d869dc73f0cd36d3de9016177d4e99c0b0973a918519bd1` |
| `fixed.json`                             | `5ee2f6b914df8b164b2419c705ba70c6413448aa14df28fc95226ccd68563c76` |
| `fixed-originals.tar.gz`                 | `45a34d5ee5bb2e0528218465df4de77dd638b892bf07943cfac71a2ca6b1a4a5` |
| `installation-unverified.json`           | `6187d7b38188cb4c7ede2c29b2b867142d51998a93632e1b32f71599c19ecf3a` |
| `installation-retry.json`                | `e5672a842e28bd90500047e54269d140ded75dc0b82adf7906bb1cf03b67c810` |
| `optional-packages.json`                 | `128b8447235424fcb18aa1cc99a49a6ebeccb23cc86d7a0704c85fd2793cbd4c` |
| `optional-candidate-verification.json`   | `b7fba68a80405f11fc95428207056596e80d1ede3032f3f467ff18eb6f219d89` |
| `practice-tests.log`                     | `8423994545b0227b4e7cb778acafc172febe72f680001fbe51b7188dfbac59dd` |
| `observer-tests.log`                     | `24a8b3b4068aacaad3437158f7664ebad395d3fc85e457f692dd7ade7b284fc3` |
| `academy-menu-tests.log`                 | `c333e3c33d115aa2424f86cf55e1b0878fed18c039bb4bcd24a364a0fb8579a2` |
| `gym-worlds-tests.log`                   | `b5f9bc574c6b210d59e710e3139701f86de2995cf929b13b51997f8222df3a56` |
| `native-dialog-red.log.gz`               | `8db1875edaa26dafbba6c171ce95bc300629b14a05c3fcc2c21cd819d941a3d1` |

The compressed red log preserves the exact pre-fix Academy assertion output,
including whitespace. Gym/Worlds fail-before observations remain in conversation
tool output; only their final unchanged-source 55-test run has a durable log here.
The first corrected pointer run's cleanup timeout remains an overall failure,
even though all target actions passed. Neither a clean retry nor these automated
receipts grants device, human-learning or public-release approval.
