# v0.18.0 local archive preservation

The independently reproducible local archive is [v0.18.0](../../../releases/v0.18.0/site/game/), with a [downloadable ZIP](../../../releases/v0.18.0/site/distribution.zip) and [release metadata](../../../releases/v0.18.0/release.json). This audit passed on 12 September 2026 while root source remained exactly `3eb42d7cb118d443e474682ee382484e0bf3c7f4`. The annotated tag object is `8a51ef1da7d69786a5c60e2125234e907e32a4be`.

The [machine audit](v018-preservation.json) is an exact copy of the original cache result: SHA-256 `08dbacd8bdcb2b9bbe767bad5a38e334511865de0d0c183d427ae102cd61e7e4`. Its statements about unchanged root HEAD describe that completed audit interval. Root subsequently advanced to `15f9a9c7c18cc5a8842a0e7bc9227e1e59c1920d` for Ready-export integration; those changes are not part of v0.18.0.

## What was checked

The local version folder was initially absent. After capturing all older release files and tags, the root Node 22.22.2 CLI completed `release-snapshot --ref v0.18.0 --version v0.18.0`. The [snapshot invocation](../../../.cache/round-28/v018-preservation/snapshot-command.json), [result](../../../.cache/round-28/v018-preservation/snapshot.stdout.json) and [before inventory](../../../.cache/round-28/v018-preservation/before.json) remain separate original records. The before inventory SHA-256 is `6a0c6084c2650662b37f0a032b2452f5b7eb72ca62fed0b1971b560961eca7b0`.

- The source TAR equals a fresh `git archive` of the tagged commit byte for byte. Safe extraction admitted **1,069 regular files / 148,304,171 bytes**, rejecting traversal, duplicate entries, links and special files.
- The extracted source's own build CLI, with the exact original version/revision under Node 22.22.2, reproduced **all 144 loose site files** byte for byte, including the ZIP, manifest and internal build marker. No current game modules, dependency installation or network input was used for rebuilding.
- All **141 ZIP entries** pass CRC and equal their loose payloads. All **140 manifest assets** match the recorded sizes and hashes; the ZIP and loose inventories match exactly.
- Offline artifact checks cover **137 files / 31,798,763 bytes**, the archived worker template/config, every entry's local worker/scope marker, and the recomputed build ID `404c451a99bdcfb727f93a3cbb67d10a21650c78f9e6b57da6aa5b162ab82cf6`.
- All **22 older release trees / 2,486 regular files / 3,179,145,209 bytes** remain exact. All **23 prior tags**, plus the already existing v0.18.0 tag, retain their object, kind, target and raw object-text hash. The [index check](../../../.cache/round-28/v018-preservation/index-audit.json) confirms all 23 version records equal their preserved release metadata; the new label is present once.

| Artifact         |       Bytes | SHA-256                                                            |
| ---------------- | ----------: | ------------------------------------------------------------------ |
| Source TAR       | 149,207,040 | `f0523ecd736ce0f7b0ece0386b538ebf09627a77819129b544e44d4ecfb83a2b` |
| Distribution ZIP |  31,888,028 | `b20aeb1dbdabb958836bb2650b92e211bd4851aa415ed4be19680e0cd804d130` |
| Manifest         |      22,835 | `a603310aa67ca95102e6e85af4496ebfe5812daba5671c62303c55ee8a782aaf` |

The [extracted archived CLI](../../../.cache/round-28/v018-preservation/audit-20260912T180209033599Z/source/scripts/game-cli.mjs), source inventory and build/offline logs remain under the workspace identified in the machine audit.

## Boundaries

This was artifact preservation and deterministic rebuilding, with no gameplay-test rerun, browser installation, physical-device, native-app or download-to-disk certification. The separate deployment task reported public Pages acceptance under workflow run **34708917074**; this report does not independently establish that public browser journey. Root's attempted public web opening was blocked by its tool, and is not counted as verification.

Only the new version tree and CLI-managed version index changed during the archive operation. Older artifacts, tags and reports were preserved. No source edit, commit, push or server change was made by this audit. Promoting these two new reports leaves their original cache evidence unchanged.
