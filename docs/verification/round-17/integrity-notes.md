# Frozen v0.7.0 integrity and reproducibility

**Passed on 12 September 2026 at 09:57 UTC.** The [machine-readable report](release-integrity.json) records the independent archive, tag, rebuild and offline-artifact checks. Its SHA-256 is `ae6a3ee6e6e32780219ac968216395080dc9e7794369b9ae619083d19415a1a6`.

## Frozen identity

The annotated `v0.7.0` tag object is `bd22efa264ee35cf1695768fff15436b8083d47b`. Its peeled commit and embedded target both equal `1d4a8d9636428122cca857533dff68c7ee65ac88`. The release record, manifest and game build information agree with this version and source revision.

| Artifact                                |       Bytes | SHA-256                                                            |
| --------------------------------------- | ----------: | ------------------------------------------------------------------ |
| `releases/v0.7.0/source.tar`            | 110,827,520 | `d22895233c1754dd1a69dd736bf4609252211e89b92c5a86ecf60d04351b9317` |
| `releases/v0.7.0/site/distribution.zip` |  20,121,610 | `a6aea955ccc0a3137f1d4d26001bb9ceac9242850f50616e65900919fe177729` |
| `releases/v0.7.0/site/manifest.json`    |      18,734 | `c2dde7df03dcd441eb9c50e213dd9fb1e84761c931730e13cee701627a786bce` |

The source TAR contains 653 regular files totaling 110,256,446 bytes. The inspection checked its PAX commit, safe relative paths, duplicate entries and file/total budgets; it rejected links and unsupported entry types before extraction. A fresh `git archive` of the frozen commit produced exactly the same source TAR bytes.

The site manifest contains 115 files totaling 20,088,090 bytes. Every size and SHA-256 matches its loose file. The ZIP has exactly those files plus the manifest: 116 entries, valid CRCs, no duplicates, encryption or symbolic links, and byte-for-byte agreement with the site. The ZIP checksum sidecar and complete loose-site inventory also match.

## Rebuilt from the archived source

The verifier extracted the validated source into a new cache directory and executed **that archive's own CLI**, using Node 22.22.2 and the original version/revision. It used no working-tree game modules, package installation or network inputs.

```sh
node .cache/round-17/integrity/v0.7.0-run-20260912T095656310365Z/source/scripts/game-cli.mjs \
  build \
  --out .cache/round-17/integrity/v0.7.0-run-20260912T095656310365Z/rebuilt-site \
  --version v0.7.0 \
  --revision 1d4a8d9636428122cca857533dff68c7ee65ac88
```

The recorded invocation used absolute paths and the extracted source as its working directory. Build exit code was zero. All **119 loose output files** have the same paths and bytes as the frozen site, including the ZIP, manifest, checksum sidecar and internal build marker. Exact commands, environment, runner hashes and logs are identified in the report. The measured build took 346 ms on this host; that is not a performance guarantee for other machines.

## Offline artifact checks

The offline inventory contains 112 files totaling 20,049,333 bytes. Its entries equal the site manifest except `_headers`, `offline-cache.json` and `service-worker.js`. Each cached file's bytes and digest match.

The worker exactly equals the archived first-party worker template with the recorded configuration inserted. Recomputing the offline build identity from frozen build information, template and normalized assets yields `d5e742c87b937a2ce1afc235e63c105306898d5c74680001094f6cb5674a484b`.

All five game HTML entry points carry the correct version/build and local release-root scope: game, controller lab, couch, playground and replay theater. The web manifest starts at `./game/`, has `./` scope and references existing icons. These are artifact checks; actual browser installation, offline navigation and storage behavior are recorded separately by the main task.

## Ten older releases remain unchanged

The comparison used the pre-release baseline `.cache/round-17/integrity/frozen-releases-before-v070.json`, SHA-256 `02377c90e0c668b477948c2c397bc40e3d0a5e87ab15a0354a3e2f1aa78c89d2`.

Every one of its **893 files / 1,188,674,354 bytes** matched both before and after the rebuild. This covers all frozen files in `v0.1.0`, `v0.1.1`, `v0.1.2`, `v0.2.0`, `v0.2.1`, `v0.3.0`, `v0.4.0`, `v0.4.1`, `v0.5.0` and `v0.6.0`, including their source archives and internal build markers. Each older release's manifest/ZIP inventory, ZIP CRCs, source identity and checksum sidecar were also rechecked. All ten tag objects, kinds and peeled commits match the baseline. The baseline itself was unchanged.

This verification changed no frozen release file, tag or prior evidence. It establishes archive identity and deterministic packaging on this host; it does not certify native packaging, store signing, physical controllers, accessibility or player enjoyment. No commit was created by the verifier.
