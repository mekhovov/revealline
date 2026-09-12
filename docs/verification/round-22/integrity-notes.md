# Frozen v0.12.0 integrity and reproducibility

**Passed on 12 September 2026 at 12:45 UTC.** The [machine-readable report](release-integrity.json) records independent archive, tag, tested-source, rebuild and offline-artifact checks. Its SHA-256 is `579ddb64e395bda3503dfb5c3b65461feda14e98dafb406b815161919e85793a`.

## Frozen identity

The annotated `v0.12.0` tag object is `57ef1b15ed8f887d8c905df499d85ca302df2fc6`. Its peeled commit and embedded target equal `640f3e3570323394a22922261e8928634db7bf3b`. The release record, manifest and game build information identify the same version and source revision.

| Artifact                |       Bytes | SHA-256                                                            |
| ----------------------- | ----------: | ------------------------------------------------------------------ |
| `source.tar`            | 116,367,360 | `0030f90969aa84e8e061382a1ba55b14ccf28810a077b7b0a919326d0b4f786d` |
| `site/distribution.zip` |  20,584,464 | `bc160dc0000557b3af5c59cebc8cd77ca553bae48244614359691073802d2d07` |
| `site/manifest.json`    |      20,560 | `89abb55adc3a47792c778df7e24ef971d1d87d989946e512e3b577445d50515b` |

These files are under `releases/v0.12.0/`. The source archive contains **831 regular files / 115,657,383 bytes**. Inspection checked the embedded PAX commit, safe relative paths, duplicate entries and file/total budgets; links and unsupported entry types are rejected. A fresh `git archive` of the exact commit reproduced every source TAR byte.

The manifest covers **126 files / 20,547,616 bytes**. Every loose asset matches its recorded size and SHA-256. The ZIP contains those assets plus the manifest: **127 entries**, valid CRCs, no duplicate, encrypted or symbolic-link entries, and exact byte agreement with the loose files. Its digest sidecar and complete loose-site inventory also match.

## Archived rebuild and tested source

The verifier safely extracted the archive into a fresh [cache workspace](../../../.cache/round-22/integrity/v0.12.0-run-20260912T124503272719Z/) and ran [that source's own CLI](../../../.cache/round-22/integrity/v0.12.0-run-20260912T124503272719Z/source/scripts/game-cli.mjs) with Node 22.22.2, the frozen version and exact revision. The actual command used absolute paths and the extracted source as its working directory. No dependency installation, network inputs or current working-tree game modules were used.

The build exited zero in 1,528 ms. All **130 loose output files** match the frozen site paths and bytes, including the ZIP, manifest, checksum sidecar and internal build marker. Exact commands, tool versions, verifier hashes and raw build/offline log paths are in the report.

All **298 final source-gate inputs** occur unchanged in the extracted source. The pinned [input report](source-inputs.json) has SHA-256 `e5ba4b248259200e17eb5f6f28659a3235853d5250c529000fee019a6caa772d`; its source aggregate is:

```text
0167da32f9d8153af70f549ec033ed38fa2c04651e63e23a4ebd96e1bf834768
```

The [final gate report](source-gates.json), SHA-256 `3d2ccc671959948d927468f34d071995cd60a5b8d4279dab19dd634d0cc66708`, records six passing gates and **1,314 passing tests**, with no failing, cancelled, skipped or TODO tests. Its before/after source aggregates are identical. Both evidence files themselves also match their archived copies. This verifies the connection to that existing test run; it does not count the integrity check as another test run. Other archived files remain outside the 298-input set.

## Offline artifact identity

The offline inventory contains **123 files / 20,505,581 bytes**, exactly the manifest excluding `_headers`, `offline-cache.json` and `service-worker.js`. Every cached size and digest matches. The worker equals its archived template with the recorded configuration inserted. Recomputing the build identity from frozen build information, template and normalized assets gives:

```text
c48ab2455a432323d7a96fb969b3c9319ea167ceda6bba8800b8ef81b286c03f
```

All game HTML paths derived from the manifest have matching version/build markers and release-root scopes: solo, Controller Lab, couch, Playground and Replay Theater. The web manifest starts at `./game/`, has scope `./` and references existing icons. These checks establish artifact configuration; browser installation, offline navigation and actual reader interaction have separate browser evidence.

## Earlier releases preserved

The [pre-freeze baseline](../../../.cache/round-22/integrity/frozen-releases-before-v0120.json) remains unchanged at SHA-256 `a47babc372faaa1459ab8d836e3decf217ddd81f283561526e0ae12a061560ce`. All **15 earlier release trees / 1,514 files / 1,954,009,358 bytes** match before and after the rebuild. Source identities, ZIP inventories/CRCs, manifests and checksum sidecars were rechecked.

The versions are `v0.1.0`, `v0.1.1`, `v0.1.2`, `v0.2.0`, `v0.2.1`, `v0.3.0`, `v0.4.0`, `v0.4.1`, `v0.5.0`, `v0.6.0`, `v0.7.0`, `v0.8.0`, `v0.9.0`, `v0.10.0` and `v0.11.0`. All **16 captured tags**, including `v0.0.9-motion-lab`, retain their exact objects, kinds, peeled targets and complete raw tag-object hashes. The new annotated v0.12.0 tag was checked separately before and after rebuilding.

No source, frozen artifact, tag or earlier evidence was changed, and no commit was created by this verification. These results establish archive identity and deterministic packaging on this host. They do not certify physical controllers/phones, native builds or signing, accessibility interaction, public/store deployment or player enjoyment. Cache files are local evidence, not promised distribution contents.
