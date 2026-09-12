# Frozen v0.9.0 integrity and reproducibility

**Passed on 12 September 2026 at 11:00 UTC.** The [machine-readable report](release-integrity.json) records archive, tag, reproducibility and offline-artifact checks. Its SHA-256 is `0827798a7412c1b3b1cfdb44dfc6bf46aacaeba9c520c700d5caa4c0ae1f031f`.

## Frozen identity

The annotated `v0.9.0` tag object is `8a791ab186af446ef884dc0184c6fedcc726e563`. Its peeled commit and embedded target both equal `315a4782a159f2274f7200e3470ec20c3859707b`. The release record, manifest and game build information agree with this version and source revision.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `source.tar` | 112,445,440 | `3877c952754d80469ef11136381b164cde59ac3d0e8f92e30f1e286526de17dd` |
| `site/distribution.zip` | 20,222,233 | `7e88f5e7c1ee1835d85bc1df7c1b0aa1763dbd66d49097005abb5dd023a6c346` |
| `site/manifest.json` | 19,234 | `fb3b40ee4f55377b2bc747bc9b946792566f69b08a6146822d4975e880dc15ce` |

These files are under `releases/v0.9.0/`. The source TAR contains **715 regular files / 111,831,832 bytes**. Inspection verified its PAX commit, safe relative names, duplicate detection and file/total budgets; links and unsupported entry types are rejected before extraction. A fresh `git archive` of the frozen commit produced the exact source TAR bytes.

The manifest covers **118 files / 20,187,801 bytes**. Every listed size and SHA-256 matches the corresponding loose file. The ZIP contains exactly those files plus the manifest: **119 entries**, valid CRCs, no duplicate, encrypted or symbolic-link entries, and byte-for-byte agreement with the site. Its checksum sidecar and complete loose-site inventory also match.

## Rebuild from archived source

The verifier safely extracted the source into a new cache directory and ran **that archive's own CLI**, using Node 22.22.2 and the exact original version/revision. It installed no packages, used no network inputs and imported no working-tree game modules.

```sh
node .cache/round-19/integrity/v0.9.0-run-20260912T110024381411Z/source/scripts/game-cli.mjs \
  build \
  --out .cache/round-19/integrity/v0.9.0-run-20260912T110024381411Z/rebuilt-site \
  --version v0.9.0 \
  --revision 315a4782a159f2274f7200e3470ec20c3859707b
```

The recorded invocation used absolute paths and the extracted source as its working directory. Build exit code was zero. All **122 loose output files** have identical paths and bytes to the frozen site, including the manifest, ZIP, checksum sidecar and internal build marker. The report records commands, environment and verifier hashes; build and offline logs remain in the [local verification workspace](../../../.cache/round-19/integrity/v0.9.0-run-20260912T110024381411Z/). This workspace is local evidence, not promised distribution content.

A separate comparison checked all **262 inputs** from the [passing source-gate inventory](source-inputs.json) against the extracted archive. Every byte count and hash matched. Their aggregate source identity remains `a07f400b660d6ea4c2c79ed525b19b242110b9e18aa8f04466909002e463f59f`. Thus the archive includes the exact recorded input set from the passing 1,098-test run. Other archived files, such as documentation, are outside that tested-input set.

## Offline artifacts

The offline inventory contains **115 files / 20,148,146 bytes**. It equals the site manifest except for `_headers`, `offline-cache.json` and `service-worker.js`; every cache entry's size and digest matches its file. The worker exactly equals the archived first-party template with the recorded configuration inserted. Recomputing the build identity from frozen build information, template and normalized assets yields:

```text
5121385538255a1a403c58212e082c21a9968ad49a4ad66779eaf350eab9d52f
```

All five game HTML entry points—solo, controller lab, couch, playground and replay theater—carry the correct version/build and local release-root scope. The web manifest starts at `./game/`, uses `./` scope and references existing icons. These are artifact checks; actual installation, offline navigation and browser storage behavior are separate root-owned checks.

## Twelve prior releases remain unchanged

The comparison used [the pre-release baseline](../../../.cache/round-19/integrity/frozen-releases-before-v090.json), SHA-256 `1d847c9950a1a6d4e8673b7bb2143526313ddf42c5d4f299e577cd355204b94b`. Its captured bytes were not rewritten. Every one of its **1,136 files / 1,491,753,488 bytes** matched before and after the rebuild, including source archives and internal build markers.

This covers `v0.1.0`, `v0.1.1`, `v0.1.2`, `v0.2.0`, `v0.2.1`, `v0.3.0`, `v0.4.0`, `v0.4.1`, `v0.5.0`, `v0.6.0`, `v0.7.0` and `v0.8.0`. Each release's source identity, manifest/ZIP inventory, CRCs and checksum sidecar was rechecked. All twelve tag objects, kinds, object-text hashes and peeled commits match the baseline. The baseline itself remains unchanged.

This verification changed no frozen release, tag, production file or prior evidence and created no commit. It establishes archive identity, deterministic packaging on this host and offline artifact configuration. It does not certify native builds/signing, physical controllers/touch devices, store/public deployment, accessibility or player enjoyment.
