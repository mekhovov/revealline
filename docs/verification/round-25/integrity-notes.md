# v0.15.0 independent release integrity

Verified on 12 September 2026 after the v0.15.0 freeze. **Pass:** the archived source reproduces the frozen web distribution byte for byte. The [machine-readable report](release-integrity.json) records every comparison, command, retained release digest and verifier identity.

## Frozen identity and inventories

| Artifact             | Verified result                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Annotated tag        | `v0.15.0`, object `8aca496c217199fbca442bd04a8ca0a231429c7a`                                          |
| Peeled source commit | `8eef7e2ada51dbd6ebec0fe134aeef667d047c6c`                                                            |
| Source TAR           | 120,207,360 bytes; 927 safe regular files totaling 119,413,595 bytes                                  |
| Manifest             | 131 assets totaling 20,578,570 bytes; manifest itself 21,386 bytes                                    |
| Distribution ZIP     | 20,616,930 bytes; 132 entries; CRC, exact inventory and every payload byte match the loose site       |
| Rebuilt loose site   | All **135 files** identical, including manifest, distribution, hash sidecar and internal build marker |

SHA-256 values:

- [Source TAR](../../../releases/v0.15.0/source.tar): `6378789151d5d1d9acb80e3dff6f8b93290e6d75a7212fb514f8fb30599cb359`.
- [Web ZIP](../../../releases/v0.15.0/site/distribution.zip): `91eca2730dd4ec55dad58bd7f466dacae6262df6df763b2072308c7e6c04932f`.
- [Manifest](../../../releases/v0.15.0/site/manifest.json): `7febf64fb939bc186b530b2470d3f39a544b62a1e7a1b572e3bd6ceab6e923ae`.

A fresh `git archive` of the exact tagged commit matches `source.tar` byte for byte, including its recorded commit identity. Safe archive inspection rejects unsafe names, duplicate entries and unsupported non-regular entries before extraction. No archived source or asset was edited.

## Rebuild and tested-source correspondence

The build ran using Node v22.22.2 against the extracted source's own [CLI](../../../.cache/round-25/integrity/v0.15.0-run-20260912T141851941729Z/source/scripts/game-cli.mjs), with its own bundled assets, exact version and revision. It used no current game modules, dependency installation or network input. Exit code was 0; the build took **1,447 ms**. Output is isolated in [the fresh rebuild directory](../../../.cache/round-25/integrity/v0.15.0-run-20260912T141851941729Z/rebuilt-site/).

```text
node source/scripts/game-cli.mjs build --out rebuilt-site --version v0.15.0 --revision 8eef7e2ada51dbd6ebec0fe134aeef667d047c6c
```

The report records the actual absolute executable, working directory and output arguments. Python 3.14.4 with zlib 1.2.12 performed archive checks on macOS-26.6.2-arm64-arm-64bit-Mach-O.

All **312 final tested source inputs** match their archived bytes. Their aggregate SHA-256 is `2ec4bcf53158131757a888b0fc2dfa6a4c94ad3e23955dc69c156b1acd186e7e`. The archived [final source gates](source-gates.json) and [input inventory](source-inputs.json) match the separately pinned reports: six successful gates and **1,444 unique passing tests**, with no failures, skips or concurrent input changes. The integrity task did not rerun those test suites. The gate report SHA-256 is `de3861555c922305d971680176198163d89d1f746465207d6e2fbf0ab151bf2d`; the input-report SHA-256 is `3dc1a74fe7932624a5794f90798561e9ee96af8741617211f1237dcc9a4fec96`.

The [initial gate report](source-gates-initial.md) remains preserved. Its version discrepancy was corrected in `game/build-config.json` before the final snapshot. The final gate report explicitly records agreement between all thirteen source metadata values and validator version 0.15.0; only that configuration file differed from the initial tested source.

## Offline artifacts and retained history

The offline inventory contains **128 files / 20,535,053 bytes**. Every listed asset hash matches the frozen file. The worker exactly matches the archived template with its generated configuration, and the independently recomputed build ID is `8b0c4581556d63a66894c21eac7aa3c2b9aaa5c6270b702034a6b96f2228554e`. All five game HTML entry pages carry matching version/build markers and resolve their worker and scope to the local release root. The web manifest starts at `./game/`, scopes to `./` and references existing icons.

The pinned [pre-v0.15 baseline](../../../.cache/round-25/integrity/frozen-releases-before-v0150.json) has SHA-256 `c3d803cffbc82312bb99713f1e539e44593ead7366a46690320c073e92a5f611`. All **18 earlier releases, 1,917 files / 2,429,728,545 bytes, and 19 captured tags** match before and after this verification. Tag checks include exact object IDs, object types, peeled commits and raw tag-object text hashes. This covers all eighteen earlier release tags and the retained motion-lab tag. No older release, tag, baseline or earlier evidence was modified.

This report establishes archive integrity, deterministic packaging and offline artifact configuration on this host. Actual browser installation, disconnected navigation, saved flights, controller interactions and control geometry are separate root-owned checks. It makes no physical pointer/controller, native application, device certification or player-enjoyment claim.
