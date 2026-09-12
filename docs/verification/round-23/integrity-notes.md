# v0.13.0 independent release integrity

Verified on 2026-09-12 after the v0.13.0 freeze. **Pass:** the archived source reproduces the frozen web distribution byte for byte. The [machine-readable report](release-integrity.json) records every comparison, command, retained release digest and verifier identity.

## Frozen identity and inventories

| Artifact             | Verified result                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Annotated tag        | `v0.13.0`, object `8f769643d246211d3ae3d451eb74eeb5ed448ab0`                                      |
| Peeled source commit | `c7b0122edffcaabbdfa6a817c06f603625f79fe0`                                                        |
| Source TAR           | 117,432,320 bytes; 865 safe regular files totaling 116,697,110 bytes                              |
| Manifest             | 129 assets totaling 20,557,979 bytes; manifest itself 21,058 bytes                                |
| Distribution ZIP     | 20,595,743 bytes; 130 entries; CRC, exact inventory and every payload byte match the loose site   |
| Rebuilt loose site   | All 133 files identical, including manifest, distribution, hash sidecar and internal build marker |

SHA-256 values:

- [Source TAR](../../../releases/v0.13.0/source.tar): `9949ef4efc86288c63647bcb34778cef150d4998a727568e41e71f35e0349de7`.
- [Web ZIP](../../../releases/v0.13.0/site/distribution.zip): `35b2470a33243fd18f19683ecec36c0b7748e38dbb93f57300bfab31eab2cac3`.
- [Manifest](../../../releases/v0.13.0/site/manifest.json): `b63caefd0362c2e23b89b50e656851ab820d97468bc7a890332d0bf38dc698fe`.

A fresh `git archive` of the exact tagged commit matches `source.tar` byte for byte, including its recorded commit identity. Safe archive inspection rejects unsafe names, duplicate entries and unsupported non-regular entries before extraction. No archived source or asset was edited.

## Rebuild and tested-source correspondence

The build ran using Node v22.22.2 against the extracted source's own [CLI](../../../.cache/round-23/integrity/v0.13.0-run-20260912T131755974455Z/source/scripts/game-cli.mjs), with its own assets, exact version and revision. It used no current game modules, dependency installation or network input. Exit code was 0; the build took 1,679 ms. Output is isolated in [the fresh rebuild directory](../../../.cache/round-23/integrity/v0.13.0-run-20260912T131755974455Z/rebuilt-site/).

```text
node source/scripts/game-cli.mjs build --out rebuilt-site --version v0.13.0 --revision c7b0122edffcaabbdfa6a817c06f603625f79fe0
```

The report records the actual absolute executable, working directory and output arguments. Python 3.14.4 with zlib 1.2.12 performed archive checks on macOS-26.6.2-arm64-arm-64bit-Mach-O.

All 306 final tested source inputs match their archived bytes. Their aggregate SHA-256 is `63b12b0487fd3a5332e95b8a01222626424f21bfdfb9472592c392ba6fbd48af`. The archived [final source gates](source-gates.json) and [input inventory](source-inputs.json) match the separately pinned reports: six successful gates and **1,406 unique passing tests**, with no failures, skips or concurrent input changes. The integrity task did not rerun those test suites.

Earlier provenance is preserved separately: the [initial run](source-gates-initial.json) recorded 1,403 passing tests and 2 failures out of 1,405; the [intermediate run](source-gates-intermediate.json) recorded 1,405 passes before the final cue regression was added. All six earlier JSON/Markdown/input reports match their pinned bytes inside the frozen source archive and remain unchanged after verification. Only the final gate report describes the frozen input set.

## Offline artifacts and retained history

The offline inventory contains **126 files / 20,515,050 bytes**. Each hash matches the frozen assets. The worker exactly matches the archived template with its generated configuration, and the independently recomputed build ID is `4a161aff62c90a2a215e7f05b733ded56d79fb64af617d7ae1fcb987a65d4657`. All five game HTML entry pages carry matching version/build markers and resolve their worker and scope to the local release root. The web manifest starts at `./game/`, scopes to `./` and references existing icons.

The pinned [pre-v0.13 baseline](../../../.cache/round-23/integrity/frozen-releases-before-v0130.json) has SHA-256 `00254c7e002cd104f83b5c77a6ab4176881691f189b3aebf979fe07055ceed89`. All **16 earlier releases, 1,646 files / 2,111,529,959 bytes, and 17 captured tags** match before and after this verification. Tag checks include exact object IDs, object types, peeled commits and raw tag-object text hashes. This covers all 16 earlier release tags and the retained motion-lab tag. No older release, tag, baseline or earlier evidence was modified.

This report establishes archive integrity, deterministic packaging and offline artifact configuration on this host. Actual browser installation, disconnected navigation, storage and Controller Lab journeys are separate root-owned checks. It makes no physical controller, native application, device certification or player-enjoyment claim.
