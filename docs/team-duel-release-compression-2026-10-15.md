# Complete-release lossless container feasibility — 15 October 2026

**A lossless complete-payload ZIP can fit the existing 950 MB limit.** The measured projection is **908,988,197 bytes**, leaving **41,011,803 bytes**. Native staging still fails its independent extracted-size limit.

This capacity experiment measures exact source `90616ad4453a2c31d29ea29e532e6ecefbf459a0`, tree `9e66fa74d7a507b7e919ad130718dc9ce351f82e`. Its measurement does not implement a new archive format. The subsequent implementation is recorded separately below. The [earlier release-readiness assessment](team-duel-release-readiness-2026-10-15.md) retains the historical working-tree sizing based on `859d5c…`; none of those older descriptors is relabeled as this source.

## Method and preservation

The older cache held only manifest descriptors, not prepared bytes. Comparing them with source `90616ad44` found 3,169 exact matching files (911,584,502 bytes), 179 absent generated files (156,230,171 bytes), and 140 transformed or differing files (4,199,765 measured bytes). Compressing only the available originals would omit required generated output and would not measure the complete distribution.

One normal `prepareBuildProject` therefore produced the complete current payload in memory with `sourceRevision` pinned and `publicationProfile: null`. Existing input checks verified the committed include closure and available producer originals before and after preparation. This check did not reconstruct the old working-tree package. The initial preflight refused an untracked Studio screenshot before any preparation; the owner moved that new artifact to ignored cache before the successful attempt.

The [analysis helper](../scripts/measure-release-zip-capacity.mjs) measures every exact prepared member plus `manifest.json`. For each member it checks the manifest length and SHA-256, applies raw deflate at level 9 / windowBits 15 / memLevel 8 / default strategy, inflates with an output bound equal to the original size (minimum one byte for empty members), checks exact byte equality and SHA-256, and repeats compression to compare the complete compressed bytes. It selects deflate only when smaller; ties keep stored bytes. The analysis removes or rewrites no runtime file, asset, authored original, license, optional chapter, soundtrack or manifest member within the prepared inventory.

The archive-size projection uses the existing writer's ZIP32 framing: 30-byte local and 46-byte central headers, both UTF-8 path names, and a 22-byte end record, with no extra fields, comments or data descriptors. This measures a potential mixed stored/deflate container. It does not create an archive, verify a compressed ZIP reader, or prove a second complete build. Repeated compression determinism is bounded to the recorded Node/zlib versions; cross-version reproducibility still requires qualification.

## Result

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

The follow-up branch implements the [source-admitted v2 archive contract](distribution-archive.md). Complete builds select the smaller of stored bytes and fixed-parameter raw deflate for each member. Unmarked builds and optional callers retain stored ZIPs. The source config, manifest, build identity and release record carry the explicit format and the existing 1 GiB expanded envelope, including the manifest. The 950 MB archive and 768 MiB native limits remain unchanged.

The frozen inspector binds admission to the exact committed source config and independently checks contiguous ZIP32 headers, paths, member sets, streamed expansion bounds, CRCs and every original hash. The local controller fixture has a bounded compatible reader; its injected controller events remain separate from physical controller evidence. The legacy Pages metadata reader accepts only matching, strictly validated v2 markers; its independent 800 MB contract still rejects the complete payload. It is not a delivery route for this candidate; the active rolling Pages builder is separate.

These implementation checks do not turn the 90616ad44 capacity projection into a produced final-source archive. Final-source sizing, canonical qualification, independent frozen inspection and public consumer acceptance remain required before release.

## Original migration requirements

At experiment source 90616ad44, the writer stored every member, and the frozen inspector required stored inner members with `manifest.totalBytes <= archive file size`. Both assumptions rejected a useful compressed container. The coordinated migration must preserve safe/unique paths, exact member-set equality, lengths, hashes, CRC verification, source binding and original-artifact identity while adding explicit bounded uncompressed-byte accounting. Its negative cases must exercise malformed compressed streams, declared-size mismatches, duplicate/overlapping entries, excessive inflation and deterministic reproduction. Each actual delivery consumer still needs acceptance; a capacity fit is not consumer compatibility.

The earlier source-preservation and required-evidence adapter blockers remain. Compression does not produce the large source archive, change the narrowly admitted source-manifest path, restore required full-suite evidence, or reconcile the actual PR/manual/inspection run topology. Final release admission must still use one reviewed merged source and the canonical independent inspection/evidence workflow.

## Retained evidence and checks

The [committed summary receipt](research/team-duel-release-compression-2026-10-15.json) retains source/tree identity, runtime/compression settings, manifest hash, grouped savings, exact counts and the detailed local report descriptor. The full 1,378,880-byte local report is `.cache/team-duel-release-readiness-20261015/deflate-complete-90616ad44.json`, SHA-256 `6d2550a9c1ce4bdde07c9c4174b83f549075251a691206c88e7bd71f8c9d6b23`; it contains original/deflated hashes and sizes for every member. It is local diagnostic evidence, not a published qualification artifact.

The exact manifest SHA-256 is `ae2061427709aa0128efc524360bd9bccfadca54b052ba39fcf8316e5e8174e3`. Before/after checks covered **3,305 included files / 859,763,816 bytes** and **40,433 available committed files / 3,160,371,126 bytes**, with no absent tracked files. The complete run took about 16 minutes: one preparation took 11 minutes 46 seconds, and all member compression/verification took 35 seconds. The process recorded peak RSS of 2,675,867,648 bytes and exited successfully; its buffers are released. No ZIP, expanded site or native stage exists from this experiment.

The helper was loaded from ignored cache to keep the measured checkout clean. Its retained script has formatting-only changes, with both hashes recorded in the receipt. Run `node --test scripts/test-measure-release-zip-capacity.mjs` for the five bounded checks. To repeat complete sizing on a future clean source, reuse `inspectDefaultBuildInputs` and `verifyAvailableCommittedSources` before and after one `prepareBuildProject({ root, sourceRevision, publicationProfile: null })`, pass the returned object to `measureReleaseZipCapacity`, reject any source change, and retain only the returned metadata. Do not use `buildProject`, which writes both an archive and expanded site.

The five bounded analysis tests cover generated output from normal preparation, byte/member preservation including originals/licenses/external content, mixed stored/deflate selection, UTF-8 ZIP overhead against the stored writer, deterministic reordering, empty files, and refusal of corrupt/incomplete/duplicate/unsafe/ZIP64 inputs. This experiment changed no production reader/writer; the subsequent implementation above has its own compatibility and malformed-archive tests. No content, capacity limit, version, tag, release or deployment is changed by that implementation.
