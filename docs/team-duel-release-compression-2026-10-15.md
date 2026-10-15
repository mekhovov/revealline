# Complete-release lossless container feasibility — 15 October 2026

**The complete local production ZIP fits the existing 950 MB limit.** Integrated source `dda86d8c6` produces **909,001,885 bytes**, leaving **40,998,115 bytes**. Both readers verify every original member. Native staging still fails its independent extracted-size limit.

This capacity experiment measures exact source `90616ad4453a2c31d29ea29e532e6ecefbf459a0`, tree `9e66fa74d7a507b7e919ad130718dc9ce351f82e`. Its measurement does not implement a new archive format. The subsequent implementation is recorded separately below. The [earlier release-readiness assessment](team-duel-release-readiness-2026-10-15.md) retains the historical working-tree sizing based on `859d5c…`; none of those older descriptors is relabeled as this source.

## Method and preservation

The older cache held only manifest descriptors, not prepared bytes. Comparing them with source `90616ad44` found 3,169 exact matching files (911,584,502 bytes), 179 absent generated files (156,230,171 bytes), and 140 transformed or differing files (4,199,765 measured bytes). Compressing only the available originals would omit required generated output and would not measure the complete distribution.

One normal `prepareBuildProject` therefore produced the complete current payload in memory with `sourceRevision` pinned and `publicationProfile: null`. Existing input checks verified the committed include closure and available producer originals before and after preparation. This check did not reconstruct the old working-tree package. The initial preflight refused an untracked Studio screenshot before any preparation; the owner moved that new artifact to ignored cache before the successful attempt.

The [analysis helper](../scripts/measure-release-zip-capacity.mjs) measures every exact prepared member plus `manifest.json`. For each member it checks the manifest length and SHA-256, applies raw deflate at level 9 / windowBits 15 / memLevel 8 / default strategy, inflates with an output bound equal to the original size (minimum one byte for empty members), checks exact byte equality and SHA-256, and repeats compression to compare the complete compressed bytes. It selects deflate only when smaller; ties keep stored bytes. The analysis removes or rewrites no runtime file, asset, authored original, license, optional chapter, soundtrack or manifest member within the prepared inventory.

The archive-size projection uses the existing writer's ZIP32 framing: 30-byte local and 46-byte central headers, both UTF-8 path names, and a 22-byte end record, with no extra fields, comments or data descriptors. This measures a potential mixed stored/deflate container. It does not create an archive, verify a compressed ZIP reader, or prove a second complete build. Repeated compression determinism is bounded to the recorded Node/zlib versions; cross-version reproducibility still requires qualification.

## Historical experiment result at 90616ad44

| Measurement                                      |                     Bytes / count | Meaning                                        |
| ------------------------------------------------ | --------------------------------: | ---------------------------------------------- |
| Complete prepared payload                        | 1,072,015,513 bytes / 3,488 files | Exact current manifest inventory               |
| Manifest                                         |                     519,029 bytes | Included as the 3,489th archive member         |
| Existing stored ZIP projection                   |               1,073,127,846 bytes | 123,127,846 over the 950 MB bound              |
| All-deflate projection                           |                 909,025,201 bytes | Also fits, but needlessly expands some members |
| Choose-smaller projection                        |             **908,988,197 bytes** | **41,011,803 bytes below 950 MB**              |
| Lossless savings                                 |                 164,139,649 bytes | 3,109 deflated members; 380 stored             |
| Exact round trips / repeated compression matches |                     3,489 / 3,489 | Every member, including the manifest           |
| Native extracted excess                          |             **266,709,145 bytes** | Still exceeds 805,306,368 bytes                |

The 41 MB margin is about 4.3% of the release limit, so it is useful but finite. Future content needs the same exact-source capacity gate. This result changes neither the source archive contract nor the main-pages publication profile.

## Why native remains blocked

Both [native source verification](../scripts/native-cli.mjs) and the [desktop resource reader](../platforms/desktop/resources.mjs) sum the manifest's uncompressed file lengths and enforce **805,306,368 bytes (768 MiB)**. Desktop staging retains those files and the original manifest, so ZIP compression changes download transport only. Neither the extracted inventory nor that limit changes. iOS must first pass the same source inventory gate before adding its bridge or applying its platform policy.

The open [native capacity issue #865](https://github.com/mekhovov/revealline/issues/865) therefore remains independent of the release ZIP result. A justified native scope/policy decision and real staging/resource verification remain necessary. This experiment supplies no evidence for silently dropping assets or increasing the bound.

## Container implementation following the experiment

The follow-up branch implements the [source-admitted v2 archive contract](distribution-archive.md). Complete builds select the smaller of stored bytes and fixed-parameter raw deflate for each member. Unmarked builds and optional callers retain stored ZIPs. The source config, manifest, build identity and release record carry the explicit format and a separate explicit 1 GiB expanded envelope, including the manifest, derived from the existing default distribution envelope. The 950 MB archive and 768 MiB native limits remain unchanged.

The frozen inspector binds admission to the exact committed source config and independently checks contiguous ZIP32 headers, paths, member sets, streamed expansion bounds, CRCs and every original hash. The local controller fixture has a bounded compatible reader; its injected controller events remain separate from physical controller evidence. The legacy Pages metadata reader accepts only matching, strictly validated v2 markers; its independent 800 MB contract still rejects the complete payload. It is not a delivery route for this candidate; the active rolling Pages builder is separate.

These implementation checks do not turn the 90616ad44 capacity projection into a produced final-source archive. Final-source sizing, canonical qualification, independent frozen inspection and public consumer acceptance remain required before release.

## Actual complete container at integrated source dda86d8c6

After rebasing without conflicts onto main `e51ff517e`, one normal complete preparation and the production adaptive ZIP writer ran at source `dda86d8c64eaba178552b9d6b8d7d9a629d6d320`, tree `ba67d9215deaf0c9b57a33748fd1270d09d50a02`. The [committed receipt](research/team-duel-compressed-archive-2026-10-15.json) retains both reader results, source checks, runtime, archive/manifest hashes and precise boundaries.

| Actual measurement                                  |                            Result |
| --------------------------------------------------- | --------------------------------: |
| Payload                                             | 1,072,048,549 bytes / 3,491 files |
| Manifest / complete member count                    |     519,621 bytes / 3,492 members |
| Production ZIP                                      |             **909,001,885 bytes** |
| ZIP headroom below 950,000,000                      |              **40,998,115 bytes** |
| Expanded archive including manifest                 |               1,072,568,170 bytes |
| Headroom below the explicit 1 GiB expanded envelope |               **1,173,654 bytes** |
| Native extracted excess above 768 MiB               |             **266,742,181 bytes** |

ZIP SHA-256 is `4c9b4693ff31cdd574414be12b75467bb02138044009153e4491cb708ab8a45c`; manifest SHA-256 is `eb86aeca3df98b5b4453a5a2ff5230087d1a58e61fdd5ce71e09f0e96c50cdeb`. Node 20.19.5 / zlib 1.3.1-470d3a2 produced the container. The complete preparation took about 7 minutes 17 seconds; writing the ZIP followed, and source verification completed about 8 minutes 42 seconds after the initial check began. Peak RSS was 3,065,217,024 bytes. No expanded site was written.

The production Python verifier independently checked the strict ZIP32 layout, bounded raw streams, every CRC/length/hash, exact manifest bytes and source-admitted marker. Archive hash and file identity stayed unchanged across inspection. The local JavaScript fixture reader then read all 3,491 payload files, plus the exact manifest, through its 64 MiB per-resource bound. Its largest resource was 15,623,239 bytes. All 32 external bodies / 130,442,755 bytes matched their exact source catalog pins and stayed outside the automatic core cache.

Before and after preparation, checks verified all 3,308 included inputs / 859,794,179 bytes and 41,392 available committed sources / 3,197,432,388 bytes, with zero absent tracked sources. Both readers exited successfully. The task-owned 909 MB ZIP was then retired to recover disk space; its manifest and detailed local receipts remain in ignored cache, with exact identities retained in the committed receipt.

The rebased archive/CLI/optional/metadata/registration cohort passes **155/155** with no skips; its Python wrapper invokes **39/39** independent new and legacy cases. A separate rebased Studio/media-host cohort passes **55/55** with no skips. These overlapping counts are not a whole-repository claim. The complete loose-site external-distribution test remains separate; this check verified its real archive bodies without creating that loose site.

This closes local complete-container capacity and both implemented reader checks at the pinned integrated source. It is one preparation, not a second full-build reproducibility proof, a cross-zlib guarantee, an outer frozen qualification artifact, an immutable release, native staging or public browser acceptance. The final merged release source still requires the canonical source-preservation, required-suite, freezing and evidence workflow. Legacy 800 MB and native 768 MiB admission remain blocked independently.

## Original migration requirements

At experiment source 90616ad44, the writer stored every member, and the frozen inspector required stored inner members with `manifest.totalBytes <= archive file size`. Both assumptions rejected a useful compressed container. The coordinated migration must preserve safe/unique paths, exact member-set equality, lengths, hashes, CRC verification, source binding and original-artifact identity while adding explicit bounded uncompressed-byte accounting. Its negative cases must exercise malformed compressed streams, declared-size mismatches, duplicate/overlapping entries, excessive inflation and deterministic reproduction. Each actual delivery consumer still needs acceptance; a capacity fit is not consumer compatibility.

The earlier source-preservation and required-evidence adapter blockers remain. Compression does not produce the large source archive, change the narrowly admitted source-manifest path, restore required full-suite evidence, or reconcile the actual PR/manual/inspection run topology. Final release admission must still use one reviewed merged source and the canonical independent inspection/evidence workflow.

## Retained evidence and checks

The [committed summary receipt](research/team-duel-release-compression-2026-10-15.json) retains source/tree identity, runtime/compression settings, manifest hash, grouped savings, exact counts and the detailed local report descriptor. The full 1,378,880-byte local report is `.cache/team-duel-release-readiness-20261015/deflate-complete-90616ad44.json`, SHA-256 `6d2550a9c1ce4bdde07c9c4174b83f549075251a691206c88e7bd71f8c9d6b23`; it contains original/deflated hashes and sizes for every member. It is local diagnostic evidence, not a published qualification artifact.

The exact manifest SHA-256 is `ae2061427709aa0128efc524360bd9bccfadca54b052ba39fcf8316e5e8174e3`. Before/after checks covered **3,305 included files / 859,763,816 bytes** and **40,433 available committed files / 3,160,371,126 bytes**, with no absent tracked files. The complete run took about 16 minutes: one preparation took 11 minutes 46 seconds, and all member compression/verification took 35 seconds. The process recorded peak RSS of 2,675,867,648 bytes and exited successfully; its buffers are released. No ZIP, expanded site or native stage exists from this experiment.

The helper was loaded from ignored cache to keep the measured checkout clean. Its retained script has formatting-only changes, with both hashes recorded in the receipt. Run `node --test scripts/test-measure-release-zip-capacity.mjs` for the five bounded checks. To repeat complete sizing on a future clean source, reuse `inspectDefaultBuildInputs` and `verifyAvailableCommittedSources` before and after one `prepareBuildProject({ root, sourceRevision, publicationProfile: null })`, pass the returned object to `measureReleaseZipCapacity`, reject any source change, and retain only the returned metadata. Do not use `buildProject`, which writes both an archive and expanded site.

The five bounded analysis tests cover generated output from normal preparation, byte/member preservation including originals/licenses/external content, mixed stored/deflate selection, UTF-8 ZIP overhead against the stored writer, deterministic reordering, empty files, and refusal of corrupt/incomplete/duplicate/unsafe/ZIP64 inputs. This experiment changed no production reader/writer; the subsequent implementation above has its own compatibility and malformed-archive tests. No content, capacity limit, version, tag, release or deployment is changed by that implementation.
