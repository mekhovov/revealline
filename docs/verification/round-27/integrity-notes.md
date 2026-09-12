# Round 27 — frozen v0.17.0 integrity

**Pass.** The frozen source archive, distribution, manifest and every packaged asset match their recorded identities. Running the **extracted archive's own CLI** reproduced all **142 loose outputs** byte-for-byte, including **138 manifest assets and 139 ZIP entries**. The [machine report](frozen-integrity.json) retains the checks, commands and exact pins; no working-tree game module or dependency installation was used for the rebuild.

The annotated `v0.17.0` tag object `4f14195f94f17efee4915264c740f0c6e9afefd0` points to source commit `a38156e337bd274bb38231e9b408abd10d56404d`. A fresh `git archive` from that commit is byte-identical to the frozen TAR. Its PAX revision matches; all **1,051 regular files / 147,969,955 payload bytes** were inspected before safe extraction. Duplicate or unsafe paths, symlinks, other special entries and oversized content are rejected by the verifier.

| Frozen artifact                                                     |       Bytes | SHA-256                                                            |
| ------------------------------------------------------------------- | ----------: | ------------------------------------------------------------------ |
| [Source archive](../../../releases/v0.17.0/source.tar)              | 148,858,880 | `74da7cfdfc36c9c21ab5180afbb598d9deba18802b25f583c653566f1879ec5e` |
| [Distribution ZIP](../../../releases/v0.17.0/site/distribution.zip) |  31,850,686 | `f6cd09198af69818b2346941181e2c22453a81c7eb85af69de577db997a4a852` |
| [Manifest](../../../releases/v0.17.0/site/manifest.json)            |      22,511 | `46e121695fc4c20d850c1ccb0ed4da26b635fcaf9b3f6c74c1476927def2a546` |

The archived CLI ran under Node.js 22.22.2, using `--version v0.17.0 --revision a38156e337bd274bb38231e9b408abd10d56404d`, and completed in **3.219 seconds**. ZIP CRCs, every ZIP-to-loose byte comparison, manifest size/hash totals, the ZIP hash sidecar, build information and the exact loose-file set pass. The [build output log](../../../.cache/round-27/integrity/v0.17.0-run-20260912T163640659816Z/build.stdout.log) and [empty error log](../../../.cache/round-27/integrity/v0.17.0-run-20260912T163640659816Z/build.stderr.log) remain in a new isolated cache directory.

## Verified source and preserved history

All **343 final source inputs** match the [gallery-final inventory](source-inputs-gallery-final.json), aggregate SHA-256 `96d5812adbf1e1886e8ebe34c351c34b690a35469030425d8197041ca2886583`. The archive also contains exact copies of all seven pinned source-evidence JSON documents.

Their scopes remain distinct: the [initial full run](source-gates-initial.md) passed **1,550 tests** but failed JSON formatting; the [formatting/gallery-layout follow-up](source-gates.md) passed its affected checks; the [loading follow-up](source-gallery-loading-followup.md) passed **25 scoped tests**, including **six new cases**. The full suite was not rerun on the final gallery code, and the integrity audit did not rerun gameplay tests. All 19 separately pinned original proof, fixture, Homeward artwork and procedural-Workshop baseline entries match their archived bytes.

All **20 earlier release trees**—**2,198 files / 2,753,850,005 bytes**—match the immutable baseline before and after. Their metadata, manifests, complete ZIP contents/CRCs and source archives were rechecked, as were **21 prior tag identities**, including object bytes, kinds and peeled targets. The new release tree and tag also remained unchanged throughout. An additional **1,868 prior verification/cache files** and the seven published evidence files stayed exact. The earlier Round26 deletion/restoration incident remains recorded in its original evidence; this audit makes no uninterrupted-history claim across that incident.

## Offline artifact and limits

The frozen offline inventory contains **135 files / 31,764,790 bytes**, within the 2,000-file / 64 MiB build budget. Build identity `9c9ead88556353f1cf1b97b737ef033eacb8e32a9807524300ce0898622fd4b2` was independently recomputed from frozen build information, the archived worker template and normalized asset hashes. The worker configuration, inventory files, all five game-page markers, local scopes and manifest icons match. [Offline artifact details](../../../.cache/round-27/integrity/v0.17.0-run-20260912T163640659816Z/offline.stdout.log) retain the exact results.

These are archive and packaging checks. Actual browser installation, offline play, asynchronous decode presentation, physical controls and native execution are separate checks; no public-host or store-readiness claim follows from this report.

The report is **59155 bytes**, SHA-256 `529dfaae6417a004b6f85652d6d5c17b1ba465405a523333807b6879cbbbb28a`, and is an exact copy of the [raw result](../../../.cache/round-27/integrity/v0.17.0-run-20260912T163640659816Z/result.json). [Verifier](../../../.cache/round-27/integrity/verify-release.py), [offline verifier](../../../.cache/round-27/integrity/verify-offline.mjs), [preservation-before inventory](../../../.cache/round-27/integrity/v0.17.0-run-20260912T163640659816Z/protected-evidence-before.json) and [preservation-after inventory](../../../.cache/round-27/integrity/v0.17.0-run-20260912T163640659816Z/protected-evidence-after.json) provide the audit trail. No source, frozen artifact, tag or older report was changed.
