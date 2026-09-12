# Frozen v0.11.0 integrity and reproducibility

**Passed on 12 September 2026 at 12:17 UTC.** The [machine-readable report](release-integrity.json) records archive, tag, rebuild, tested-source and offline-artifact checks. Its SHA-256 is `cf0e26926904df9c939649bd49d8481c977e467a9be3396aab9e44759fd37d7c`.

## Frozen identity

The annotated `v0.11.0` tag object is `15edf83529e289a967289820bbc43ecd344c8779`. Its peeled commit and embedded target equal `7bc32d62fb7ec9c24e8b8dc5a80a016bbb76c2db`. The release record, manifest and game build information agree with this version and source revision.

| Artifact                |       Bytes | SHA-256                                                            |
| ----------------------- | ----------: | ------------------------------------------------------------------ |
| `source.tar`            | 114,862,080 | `ac2cd79547dc3e2c481b7bbecb0d6d2225d3dbebf16452aa4274cb0ec03c7c7d` |
| `site/distribution.zip` |  20,558,157 | `8e066a13120961bbb6c139edb95ff51a2838f5a1d74a051f8776277885f62158` |
| `site/manifest.json`    |      20,219 | `c6558d315f811ac35e6444b6e759e27dd4f74ca2732cfc19fcc7b46af4ae5bda` |

These files are under `releases/v0.11.0/`. The source TAR contains **798 regular files / 114,178,803 bytes**. Inspection checked the embedded PAX commit, safe relative paths, duplicate entries and per-file/total budgets, rejecting links and unsupported entry types before extraction. Regenerating `git archive` from the exact commit produced identical TAR bytes.

The manifest covers **124 files / 20,521,944 bytes**, each matching its loose file's size and SHA-256. The ZIP contains those assets plus the manifest: **125 entries**, with valid CRCs, no duplicates, encrypted entries or symbolic links, and exact byte agreement with the loose site. The checksum sidecar and complete site inventory match.

## Archived rebuild and tested-source match

The verifier extracted the validated archive into a fresh cache directory and ran **that source's own CLI** with Node 22.22.2 and the frozen version/revision. It installed no packages, used no network inputs and imported no current working-tree game modules.

```sh
node .cache/round-21/integrity/v0.11.0-run-20260912T121736118360Z/source/scripts/game-cli.mjs \
  build \
  --out .cache/round-21/integrity/v0.11.0-run-20260912T121736118360Z/rebuilt-site \
  --version v0.11.0 \
  --revision 7bc32d62fb7ec9c24e8b8dc5a80a016bbb76c2db
```

The actual command used absolute paths and the extracted source as its working directory. It exited zero. All **128 loose output files** match the frozen site paths and bytes, including ZIP, manifest, checksum sidecar and internal build marker. Exact command, tool versions, verifier hashes and build result are in the report; raw build/offline logs remain in the [verification workspace](../../../.cache/round-21/integrity/v0.11.0-run-20260912T121736118360Z/).

All **295 final source-gate inputs** occur unchanged in the archive. The pinned [input report](source-inputs.json) has SHA-256 `1c04d2506325b838738940ed831a2255d40f3e5626d7891d57c2475fc3fc4852`; its source aggregate is:

```text
3aed055469e7a9b345e7d9a89b42646fa44be634cb7225cfebd9dbfc0894edfb
```

This is the source set from the [final 1,276-test gate run](source-gates.md), including the aggregate-proof repair and custom viewport corrections. The earlier failed run remains historical evidence. Other archived files, such as documentation, are outside this tested-input set.

## Offline artifacts

The offline inventory contains **121 files / 20,480,523 bytes**, exactly the manifest excluding `_headers`, `offline-cache.json` and `service-worker.js`. Every cached size and hash matches. The worker exactly equals the archived template with its recorded configuration inserted. Recomputing its build identity from frozen build information, template and normalized assets yields:

```text
4fbc019f66f95046a4c609e20ba3df5219174ebf6268e33cfa28b441302c8a71
```

All five game HTML entry points—solo, controller lab, couch, playground and replay theater—carry the correct version/build and release-root scope. The web manifest starts at `./game/`, uses `./` scope and references existing icons. These are artifact checks; actual browser installation and offline interaction are separate root-owned checks.

## Preserved releases and tags

The [prepared baseline](../../../.cache/round-21/integrity/frozen-releases-before-v0110.json) remains unchanged, SHA-256 `09a10e89db4e4f9c9f94c13f8907da9641bbd6b8c56367252f2e88815bd76b5b`. All **14 earlier release trees / 1,384 files / 1,798,046,357 bytes** match before and after this rebuild. Their source identities, manifests, ZIP inventories/CRCs and checksum sidecars were rechecked.

The captured versions are `v0.1.0`, `v0.1.1`, `v0.1.2`, `v0.2.0`, `v0.2.1`, `v0.3.0`, `v0.4.0`, `v0.4.1`, `v0.5.0`, `v0.6.0`, `v0.7.0`, `v0.8.0`, `v0.9.0` and `v0.10.0`. All **15 captured Git tags**—those releases plus `v0.0.9-motion-lab`—retain their exact objects, kinds, peeled targets and raw object-text hashes. The new annotated v0.11.0 tag was checked separately against its frozen commit.

No production or frozen file, tag or earlier report was changed, and no commit was created. These results establish archive identity, deterministic packaging on this host and offline artifact configuration. They do not certify physical devices/controllers, native builds/signing, accessibility interaction, public/store deployment or player enjoyment. Cache files are local verification evidence, not promised distribution contents.
