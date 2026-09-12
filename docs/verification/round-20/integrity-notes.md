# Frozen v0.10.0 integrity and reproducibility

**Passed on 12 September 2026 at 11:28 UTC.** The [machine-readable report](release-integrity.json) records archive, tag, rebuild, tested-source and offline-artifact checks. Its SHA-256 is `929548865738ef81772bcf97ee2ddb457de81bb4404e6f24791d5200cb7dc4e2`.

## Frozen identity

The annotated `v0.10.0` tag object is `78d91a364e83c463c65513755c9e84aaccbc56f3`. Its peeled commit and embedded target both equal `40ae9d23ad8737c4f77f9cc07923948133b7c09d`. The release record, manifest and game build information agree with this version and source revision.

| Artifact                |       Bytes | SHA-256                                                            |
| ----------------------- | ----------: | ------------------------------------------------------------------ |
| `source.tar`            | 112,967,680 | `cfc48dd29d71eefaef128a839a38f2f1302ec5f63a3994742adb0cf84242eeab` |
| `site/distribution.zip` |  20,232,240 | `1bc32886efd395f00280099e3133376ffc384d7ab7d304481f3fc9eb5c536ec9` |
| `site/manifest.json`    |      19,236 | `bf5f607fcea10e9db421799bb900ecc6ab8364239f22b6a2ca89bf473a72a02d` |

These files are under `releases/v0.10.0/`. The source TAR contains **743 regular files / 112,324,399 bytes**. Inspection checked the embedded PAX commit, safe relative paths, duplicate entries and file/total budgets. Links and unsupported entry types were rejected before extraction. Regenerating `git archive` from the exact frozen commit produced identical source TAR bytes.

The manifest covers **118 files / 20,197,806 bytes**. Every listed byte count and SHA-256 matches its loose file. The ZIP contains those files plus the manifest: **119 entries**, with valid CRCs, no duplicate, encrypted or symbolic-link entries and exact agreement with the site bytes. The checksum sidecar and complete loose-site inventory also match.

## Rebuild and final tested-source match

The verifier extracted the validated source into a new cache directory and executed **that archive's own CLI**, using Node 22.22.2 and the original version/revision. It installed no packages, used no network inputs and imported no current working-tree game modules.

```sh
node .cache/round-20/integrity/v0.10.0-run-20260912T112825830198Z/source/scripts/game-cli.mjs \
  build \
  --out .cache/round-20/integrity/v0.10.0-run-20260912T112825830198Z/rebuilt-site \
  --version v0.10.0 \
  --revision 40ae9d23ad8737c4f77f9cc07923948133b7c09d
```

The actual command used absolute paths and the extracted source as its working directory. It exited zero. All **122 loose output files** match the frozen site paths and bytes, including ZIP, manifest, checksum sidecar and internal build marker. The report records the command, environment, verifier hashes and build output; raw build/offline logs remain in the [local verification workspace](../../../.cache/round-20/integrity/v0.10.0-run-20260912T112825830198Z/). These cache files are evidence, not promised distribution contents.

The runner also checks that all **266 final source-gate inputs** occur unchanged in the archive. It pins [the final source-input report](source-inputs.json), SHA-256 `a38fcd4ce199a1efd5b3708b36876c1967636ad864b72334d41f2061a73eca37`, and checks every file's bytes and hash. Its aggregate is:

```text
a96de4954e0308dc867458c48c5b4ddaab202a6892b856f4c4191e3e1d3d5217
```

This is the input set from [the final 1,128-test run](source-gates.md), after the HTML/CSS reward-notice placement fix. The earlier passing attempt is preserved as history and is not substituted for this final inventory. Other archived files, such as documentation, are outside the tested-input set.

## Offline artifacts

The offline inventory contains **115 files / 20,158,147 bytes**. It equals the manifest except `_headers`, `offline-cache.json` and `service-worker.js`; every cached file's byte count and digest matches. The worker exactly equals the archived first-party template with the recorded configuration inserted. Recomputing the build identity from frozen build information, template and normalized assets yields:

```text
4a485c5a775e326eb95093c583d954c181485b1afa524485b5f7a3748b6cbd53
```

All five HTML game entry points—solo, controller lab, couch, playground and replay theater—carry the correct version/build and release-root scope. The web manifest starts at `./game/`, uses `./` scope and references existing icons. These checks establish artifact configuration; browser installation, offline navigation and storage behavior are separate root-owned checks.

## Prior releases and all captured tags

The [pre-release baseline](../../../.cache/round-20/integrity/frozen-releases-before-v0100.json) remains unchanged, SHA-256 `892fcff7bcd69a6851a8bb607c839a4a3cc403d82d08b43c4369833da154ce3f`. All **13 earlier release trees**, comprising **1,260 files / 1,644,628,794 bytes**, matched before and after the rebuild. This includes source archives and internal build markers. Each older release's source identity, manifest/ZIP inventory, CRCs and checksum sidecar was rechecked.

The captured versions are `v0.1.0`, `v0.1.1`, `v0.1.2`, `v0.2.0`, `v0.2.1`, `v0.3.0`, `v0.4.0`, `v0.4.1`, `v0.5.0`, `v0.6.0`, `v0.7.0`, `v0.8.0` and `v0.9.0`. All **14 captured Git tags**—those release tags plus `v0.0.9-motion-lab`—retain their exact objects, kinds, peeled targets and raw object-text hashes before and after verification. The new v0.10.0 annotated tag was checked separately against its frozen commit.

No frozen release, tag, production file or earlier evidence was changed, and no commit was created. These results establish archive identity, deterministic packaging on this host and offline artifact configuration. They do not certify native builds/signing, physical devices/controllers, accessibility, public/store deployment or player enjoyment.
