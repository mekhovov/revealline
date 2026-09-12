# v0.20.0 frozen integrity and candidate equality

The independent audit **passed on 12 September 2026 at 19:04:32 UTC**. Frozen source `a9578e0aecacf8d78fbc097406f5f603f5de41cc` rebuilt with its own archived CLI into **146 byte-identical packaged files**. Every file in the separately built candidate also matches the frozen site. All 24 earlier release trees, 25 prior tags and 490 protected evidence files remain unchanged.

The [machine report](v020-integrity.json) is an exact copy of the [original audit JSON](../../../.cache/round-29/audit-preparation/audit-20260912T190419201708Z/audit.json): **42,531 bytes**, SHA-256 `86cff7f0fbff166f66d039d93fbae5fcaf109fcf35b0d58c621ef1414529753c`. The audit ran once; no source gate or browser journey was repeated.

## Frozen identity

Annotated tag `v0.20.0`, object `3adac423d22a47598997098145001f1ee3e3ea41`, peels to the source commit above. Release metadata, tag text and runtime build metadata agree.

| Artifact                                                            |       Bytes | SHA-256                                                            |
| ------------------------------------------------------------------- | ----------: | ------------------------------------------------------------------ |
| [Source TAR](../../../releases/v0.20.0/source.tar)                  | 149,637,120 | `ef38495fb004d4d132ff5644903003a840af3a7afd4e83123fa3ed7051e30fa8` |
| [Distribution ZIP](../../../releases/v0.20.0/site/distribution.zip) |  31,922,262 | `49e7ecf250e64fce55bc22d2b37910ad6e434ba7731445984d470cc34fb4ba9b` |
| [Manifest](../../../releases/v0.20.0/site/manifest.json)            |      23,150 | `722e6fb5d6cc6f49df3d62914b56708d2419ac541baa93aaef58b8cd14044267` |

The TAR exactly matches a fresh `git archive` of that commit. Bounded extraction rejected traversal, links, duplicates and special entries, producing **1,095 regular files / 148,705,712 bytes**. Its [inventory](../../../.cache/round-29/audit-preparation/audit-20260912T190419201708Z/source-inventory.json) records every extracted file.

All **354 inputs** from the completed [1,683-test source gates](v020-source-gates.md) match their archived sizes and hashes. Their recorded aggregate remains `f5d5bab1b777a2e55ec6b47b184b8e1ea849e451c0ba249708b2358aa57a875e`; source-gate records, logs and the corrected runner were rehashed without executing them.

## Rebuild, ZIP and candidate

Node **22.22.2** executed the [archived CLI](../../../.cache/round-29/audit-preparation/audit-20260912T190419201708Z/source/scripts/game-cli.mjs) from the extracted source directory, using `build --version v0.20.0 --revision a9578e0aecacf8d78fbc097406f5f603f5de41cc` and a new output directory. It exited successfully in 2,400 ms. [Build output](../../../.cache/round-29/audit-preparation/audit-20260912T190419201708Z/build.stdout.json) and [stderr](../../../.cache/round-29/audit-preparation/audit-20260912T190419201708Z/build.stderr.log) are retained.

The manifest contains **142 assets / 31,880,756 bytes**. All **143 ZIP entries** pass CRC and match their corresponding loose bytes. The complete **146-file** site inventory, ZIP, checksum sidecar, manifest and build marker match the archived-source rebuild.

The [candidate comparison](../../../.cache/round-29/audit-preparation/audit-20260912T190419201708Z/candidate-frozen-comparison.json) separately checks every path, size, hash and actual byte against `.cache/round-29/v020-candidate-a9578e0/site`. All **146 files / 63,826,304 aggregate bytes**, including the ZIP, match the frozen site. The comparison is **57,950 bytes**, SHA-256 `bd0d459bd99be38fcfc1c6879830905814fee3b7da49d4ee02f03d86bec2c7a3`. Candidate build identity and its log also match the tested revision and release label. QA wrapper HTML outside `site` is outside this artifact inventory.

## Offline identity and preservation

The [offline artifact check](../../../.cache/round-29/audit-preparation/audit-20260912T190419201708Z/offline.stdout.json) verifies **139 precache files / 31,831,880 bytes**, build ID `5180bbe92651fd63551c9b31b23350c39e9878bc281b0d2d35aba3cdcbfd35bb`. The worker matches the archived template with its exact embedded configuration; the build ID is recomputed from normalized assets. All five game HTML entry markers point to the correct local worker/root scope, and the web manifest retains `./game/` as its start URL and `./` as its scope.

The [preservation baseline](../../../.cache/round-29/preservation/before.json), SHA-256 `87617d0cc5a59a660d5c9069cfd5becdc8953dba7417910dc6d72ffa776ce08b`, matches before and after: **24 prior releases / 2,780 files / 3,605,305,379 bytes**, **25 exact prior tags**, and **490 protected evidence files / 35,680,670 bytes**. Exactly one release and annotated tag were added. The version index contains the preserved metadata plus v0.20.0, for 25 independently saved releases.

These checks establish artifact identity and reproducibility on this host. Browser/offline interaction, QA-frame console observations and origin-specific storage behavior belong to the separate [browser report](v020-browser.md); identical candidate bytes do not constitute a second browser run. No physical-device, native-store or public-deployment acceptance is claimed here. The audit changed no source, release, tag, prior evidence or running server and created no commit.
