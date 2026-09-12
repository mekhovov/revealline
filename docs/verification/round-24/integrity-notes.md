# v0.14.0 independent release integrity

Verified on 2026-09-12 after the v0.14.0 freeze. **Pass:** the archived source reproduces the frozen web distribution byte for byte. The [machine-readable report](release-integrity.json) records every comparison, command, retained release digest and verifier identity.

## Frozen identity and inventories

| Artifact             | Verified result                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Annotated tag        | `v0.14.0`, object `b61d48560efd0423f163557c46ef81b5bafbecbd`                                      |
| Peeled source commit | `21dfaeed08df95e7cb1d0e20c28c39b3fd3364ee`                                                        |
| Source TAR           | 118,405,120 bytes; 890 safe regular files totaling 117,647,598 bytes                              |
| Manifest             | 130 assets totaling 20,562,954 bytes; manifest itself 21,215 bytes                                |
| Distribution ZIP     | 20,600,995 bytes; 131 entries; CRC, exact inventory and every payload byte match the loose site   |
| Rebuilt loose site   | All 134 files identical, including manifest, distribution, hash sidecar and internal build marker |

SHA-256 values:

- [Source TAR](../../../releases/v0.14.0/source.tar): `c0701c46a82a857cd0a4a2e66cf72041856f519aa403cac1f5a81dd3ed812915`.
- [Web ZIP](../../../releases/v0.14.0/site/distribution.zip): `926abf6ba536a50ab951b27644cccd15d1c503c8a4519c1b6b79c041b39556c1`.
- [Manifest](../../../releases/v0.14.0/site/manifest.json): `77a60de67b27a3002f073a3fc4573716abcf1d352d7dfd3a24eea856692a6b4c`.

A fresh `git archive` of the exact tagged commit matches `source.tar` byte for byte, including its recorded commit identity. Safe archive inspection rejects unsafe names, duplicate entries and unsupported non-regular entries before extraction. No archived source or asset was edited.

## Rebuild and tested-source correspondence

The build ran using Node v22.22.2 against the extracted source's own [CLI](../../../.cache/round-24/integrity/v0.14.0-run-20260912T134247140963Z/source/scripts/game-cli.mjs), with its own assets, exact version and revision. It used no current game modules, dependency installation or network input. Exit code was 0; the build took 1,819 ms. Output is isolated in [the fresh rebuild directory](../../../.cache/round-24/integrity/v0.14.0-run-20260912T134247140963Z/rebuilt-site/).

```text
node source/scripts/game-cli.mjs build --out rebuilt-site --version v0.14.0 --revision 21dfaeed08df95e7cb1d0e20c28c39b3fd3364ee
```

The report records the actual absolute executable, working directory and output arguments. Python 3.14.4 with zlib 1.2.12 performed archive checks on macOS-26.6.2-arm64-arm-64bit-Mach-O.

All 310 final tested source inputs match their archived bytes. Their aggregate SHA-256 is `fb5db87044538f9dd2f5f2e1642999714cc175d0a656acdf0a973625ecc30c2f`. The archived [final source gates](source-gates.json) and [input inventory](source-inputs.json) match the separately pinned reports: six successful gates and **1,439 unique passing tests**, with no failures, skips or concurrent input changes. The integrity task did not rerun those test suites. The gate report SHA-256 is `13b82dcd37dff0aadfb9ce3911c346f5ef671a86d0370806b720914b9a8e68c6`; the input-report SHA-256 is `427943dea68086bc4ee4edec031228959d9ebb37f575defc07c4e03f1590a7e0`.

## Offline artifacts and retained history

The offline inventory contains **127 files / 20,519,745 bytes**. Every listed asset hash matches the frozen file. The worker exactly matches the archived template with its generated configuration, and the independently recomputed build ID is `676d0bf4990099f7b8fd16bf6e15587202324680fcc6d8c320707e126014b910`. All five game HTML entry pages carry matching version/build markers and resolve their worker and scope to the local release root. The web manifest starts at `./game/`, scopes to `./` and references existing icons.

The pinned [pre-v0.14 baseline](../../../.cache/round-24/integrity/frozen-releases-before-v0140.json) has SHA-256 `1ef4966fee967e808e9c46c08b7c668e95174d1585e5f69ae77cb94c713508d7`. All **17 earlier releases, 1,781 files / 2,270,137,660 bytes, and 18 captured tags** match before and after this verification. Tag checks include exact object IDs, object types, peeled commits and raw tag-object text hashes. This covers all 17 earlier release tags and the retained motion-lab tag. No older release, tag, baseline or earlier evidence was modified.

This report establishes archive integrity, deterministic packaging and offline artifact configuration on this host. Actual browser installation, disconnected navigation, storage, Retry and controller-reading journeys are separate root-owned checks. It makes no physical controller, native application, device certification or player-enjoyment claim.
