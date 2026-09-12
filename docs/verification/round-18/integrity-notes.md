# Frozen v0.8.0 integrity and reproducibility

**Passed on 12 September 2026 at 10:27 UTC.** The [machine-readable report](release-integrity.json) records the independent archive, tag, rebuild and offline-artifact checks. Its SHA-256 is `13823557263e475fb3992af86486f7e5171f9e81174a5a10312e5028c7ecd502`.

## Frozen identity

The annotated `v0.8.0` tag object is `7aaa39e0b2ae10d6438b026cebacae5268c4b058`. Its peeled commit and embedded target both equal `8410d814dbcc7b3aef53e11c6f94d384d01cce05`. The release record, manifest and game build information agree with this version and source revision.

| Artifact                                |       Bytes | SHA-256                                                            |
| --------------------------------------- | ----------: | ------------------------------------------------------------------ |
| `releases/v0.8.0/source.tar`            | 111,718,400 | `6ea37522cf6e253b2999611b2a66e0a2aa661dac61ca37d7db6771edfe86e52b` |
| `releases/v0.8.0/site/distribution.zip` |  20,159,249 | `eeaf8ec821909d07d5d187cf2fbf0ddb968b041d346d4c200e7d7f58ff15e412` |
| `releases/v0.8.0/site/manifest.json`    |      18,896 | `32c76ce0742f9c7bd78e50ece49a58a43ff05cf6a6f9566159e1593c997567f0` |

The source TAR contains **681 regular files / 111,127,221 bytes**. Inspection checked its PAX commit, safe relative paths, duplicate entries and file/total budgets, and rejected links and unsupported entry types before extraction. A fresh `git archive` of the frozen commit produced exactly the same source TAR bytes.

The manifest contains **116 files / 20,125,439 bytes**. Every size and SHA-256 matches its loose file. The ZIP has exactly those files plus the manifest: **117 entries**, valid CRCs, no duplicates, encryption or symbolic links, and byte-for-byte agreement with the site. The ZIP checksum sidecar and complete loose-site inventory also match.

## Rebuilt from archived source

The verifier extracted the validated source into a fresh cache directory and executed **that archive's own CLI**, using Node 22.22.2 and the original version/revision. It used no working-tree game modules, package installation or network inputs.

```sh
node .cache/round-18/integrity/v0.8.0-run-20260912T102744473716Z/source/scripts/game-cli.mjs \
  build \
  --out .cache/round-18/integrity/v0.8.0-run-20260912T102744473716Z/rebuilt-site \
  --version v0.8.0 \
  --revision 8410d814dbcc7b3aef53e11c6f94d384d01cce05
```

The recorded invocation used absolute paths and the extracted source as its working directory. Build exit code was zero. All **120 loose output files** have identical paths and bytes to the frozen site, including the ZIP, manifest, checksum sidecar and internal build marker. Exact commands, environment, runner hashes and logs are identified in the report. The build took 314 ms on this host; this is not a performance guarantee for other machines.

## Offline artifacts

The offline inventory contains **113 files / 20,086,392 bytes**. Its entries equal the site manifest except `_headers`, `offline-cache.json` and `service-worker.js`. Every cached file's bytes and digest match.

The worker exactly equals the archived first-party template with the recorded configuration inserted. Recomputing the offline build identity from the frozen build information, template and normalized assets yields `176cbe39c36029e758c2016ade1e8eed770fccc62266a8282f4d09688abefe92`.

All five game HTML entry points carry the correct version/build and local release-root scope: game, controller lab, couch, playground and replay theater. The web manifest starts at `./game/`, has `./` scope and references existing icons. These are artifact checks; actual browser installation, offline navigation and storage behavior are separate owner-run checks.

## Eleven older releases remain unchanged

The comparison used the pre-release baseline `.cache/round-18/integrity/frozen-releases-before-v080.json`, SHA-256 `f29564bdff255309f710e35a12c105fc5cbbec1964bcb5ab5e571721ecee5907`. Inventory ordering was normalized by full relative path for comparison; the captured baseline bytes were never rewritten.

Every one of its **1,014 files / 1,339,730,906 bytes** matched both before and after the rebuild. This covers every frozen file in `v0.1.0`, `v0.1.1`, `v0.1.2`, `v0.2.0`, `v0.2.1`, `v0.3.0`, `v0.4.0`, `v0.4.1`, `v0.5.0`, `v0.6.0`, `v0.7.0`, including source archives and internal build markers. Each older release's source identity, manifest/ZIP inventory, ZIP CRCs and checksum sidecar were also rechecked. All eleven tag objects, kinds, object text hashes and peeled commits match the baseline. The baseline itself remains unchanged.

This verification changed no frozen release file, tag or prior evidence. It establishes archive identity, deterministic packaging on this host, and offline artifact configuration. It does not certify native packaging, signing, physical controllers, accessibility or player enjoyment. No commit was created by the verifier.
