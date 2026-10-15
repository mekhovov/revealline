# Team and Duel release readiness — 15 October 2026

The expansion can continue through the rolling browser channel, but a new complete downloadable release and native app are **not release-ready**. The current immutable-release workflow has separate source, distribution and evidence-contract blockers. No capacity limit, retained asset, version, tag, release, deployment or device setting was changed by this investigation.

This review started from `859d5cfc927daff2a350318b2325486a58959648`, tree `f24624082c594ea4bdd11d622b56eefb70411018`. Other agents were implementing the remaining offline and Studio changes in the shared checkout. The build inspections therefore deliberately use `sourceRevision: null`: they measure a working-tree preparation, not the final integrated commit or a frozen release. The source-manifest experiment separately binds the exact committed tree above.

## Current publishing paths

The live repository workflow inventory and release API were read on 15 October 2026. [The retained measurement receipt](research/team-duel-release-readiness-2026-10-15.json) records the observations and their scope.

- **Rolling browser channel:** [publish-main-pages.yml](../.github/workflows/publish-main-pages.yml) builds protected `main` with the existing `main-pages` profile, stages reviewed optional practice packages, then checks the complete hosted directory against **980,000,000 bytes**. It removes the downloadable ZIP from the hosted tree. This is the currently active Pages publisher.
- **Downloadable releases:** [fastline-release.yml](../.github/workflows/fastline-release.yml) coordinates exact-source admission, qualification, frozen inspection, evidence and guarded publication. `shadow` checks admission only; it does **not** execute qualification or frozen inspection. `publish` can automatically dispatch a publication resume, so it is not a harmless way to obtain a candidate.
- **Independent qualification/inspection:** [qualify-release-source.yml](../.github/workflows/qualify-release-source.yml) can qualify and freeze a merged-main source and inspect a separately reviewed artifact binding without publishing a release. The actual final source, artifact and successful evidence must be supplied; an old package or local test count cannot substitute for them.
- **Latest downloadable release:** [v0.142.3](https://github.com/mekhovov/revealline/releases/tag/v0.142.3), release ID `398753035`, published 29 September 2026, source `b5ab06e12542f72e33c45b973ba693a5e1509c1c`. Its ZIP is **743,263,890 bytes**, SHA-256 `37eca33f66bf24339d8d75a0b0920340b678e287b9233ed9fe39567cfd05e224`. It predates this expansion. The GitHub API reports `immutable: false`; this report uses “immutable release” for the repository's no-rewrite artifact contract, not a GitHub-enforced release lock.

Older deployment documents still name `publish-frozen-pages.yml` and its 950 MB hosted limit. That workflow no longer exists in this checkout. Its historical selector remains at v0.142.3, but it does not establish the rolling channel's current identity. The separate frozen-release utility still enforces a **950,000,000-byte distribution ZIP limit**. These are different contracts; the newer rolling-channel limit does not authorize raising either release or native limits.

## Current lossless-container continuation

The [complete-source compression experiment](team-duel-release-compression-2026-10-15.md) separately measures committed source `90616ad4453a2c31d29ea29e532e6ecefbf459a0`: all 3,489 archive members round-trip exactly, with a choose-smaller stored/deflate projection of **908,988,197 bytes**, 41,011,803 below the existing ZIP limit. The extracted payload remains **1,072,015,513 bytes**, 266,709,145 over the unchanged native limit. These newer exact-source values do not replace the historical working-tree measurements below.

The continuation implements the [source-admitted v2 container contract](distribution-archive.md) in the complete writer, frozen inspector and local archive fixture. Its explicit expanded budget retains the existing 1 GiB envelope, including the manifest. Exact-source marker agreement, original-byte hashes and bounded strict ZIP/deflate validation are required. Legacy unmarked stored releases remain supported. The historical Pages metadata reader also gains strict matching-marker support, while its separate 800 MB limit still rejects this complete candidate. This is source implementation, not a produced final-source archive or a published release.

## Measured capacity

The existing `inspectBuildProject` complete preparation finished without allocating a ZIP or writing an expanded site. It performs the normal content/reference preparation and returns the final generated manifest. The complete preparation has **3,488 manifest files / 1,072,014,438 payload bytes**. Its 518,990-byte manifest has SHA-256 `6e93db98b9cefe687b64cefae0042f139852560e609953be1d1d4a208678c175`.

The optional second `main-pages` preparation was deliberately stopped before completion to return CPU to the scoped native performance checks. Its owned process exited with code 143; it produced no inspection, ZIP or expanded site. **Current-source main-pages capacity was not measured.** Separately, the parent's [stable public dependency audit](research/multiplayer-public-acceptance-dependencies-2026-10-15.json) passed for source `3fe21888bfa4b406c51e1ab165c0782d5d936af0`: **357 URLs / 251,341,753 bytes**, zero failures, covering the 180 expansion/Hunt missions. That subset audit is not a whole-hosted-site capacity or current-working-tree verdict.

The current ZIP writer stores every member uncompressed, with 76 header bytes plus twice the UTF-8 path length per member and a 22-byte end record. Applying that layout to the measured descriptors, including `manifest.json`, projects **1,073,126,732 ZIP bytes**. This is an exact layout-size calculation for those descriptors, **not** a newly generated archive or CRC verification.

| Contract                             |      Measured value |                               Existing limit | Result                                   |
| ------------------------------------ | ------------------: | -------------------------------------------: | ---------------------------------------- |
| Complete native payload              | 1,072,014,438 bytes |                  805,306,368 bytes (768 MiB) | 266,708,070 bytes over                   |
| Complete native file count           |               3,488 |                                        4,096 | Within count limit                       |
| Largest native payload member        |    15,623,239 bytes |                             67,108,864 bytes | Within individual-file limit             |
| Projected complete release ZIP       | 1,073,126,732 bytes |                            950,000,000 bytes | 123,126,732 bytes over                   |
| Exact committed source blob contents | 3,159,483,900 bytes | 2,000,000,000-byte `source.tar` upload limit | TAR cannot fit even before its headers   |
| Source-manifest alternative          |     9,579,681 bytes |                             33,554,432 bytes | Local create and independent reread pass |

The largest complete-payload groups are `game/content-design/assets` (**273,267,869 bytes**), `game/editions/assets` (**151,161,476**) and `game/content/packs` (**119,035,083**). These totals identify where further analysis belongs; they do not show that any file is unused or removable. The prior [complete package receipt](research/multiplayer-local-package-2026-10-15.json) remains valid for its earlier `2a29a9dc…` source, not this newer composition.

The existing [native capacity issue #865](https://github.com/mekhovov/revealline/issues/865) remains open. Both the staging verifier and desktop resource reader retain the same 768 MiB bound. ZIP compression cannot solve that extracted native-payload limit.

## Evidence-contract defect and bounded fix

The exact source's [test policy](../publishing/test-policy.json) is `required`, with the 4 October restoration authorization. Fastline nevertheless always selects `assemble-waived-release-evidence.yml` on resume. That assembler explicitly refuses any exact source whose policy is not `waived`. Previously, the mismatch could be discovered only after expensive qualification, freezing and inspection.

The new [early evidence-contract guard](../publishing/fastline-release-evidence.mjs) reads the policy from the exact checked-out source immediately after its identity check. A required-policy `publish` or `resume` fails before qualification or artifact lookup. A read-only `shadow` reports the unsupported adapter and repeats the publication blocker in its summary. Explicit historical waivers retain their existing path, and missing or malformed policy fails closed. No waiver is introduced and no required test is removed.

The repository has a [full-test evidence assembler](../publishing/utility/ASSEMBLE-FULL.md), but it is not a compatible Fastline drop-in:

1. Its binding requires **three distinct PR, manual-qualification and inspection run IDs**. Fastline currently combines qualification and inspection in one run.
2. Its manual family requires the dedicated qualification workflow and dispatch event. Its PR authority parser expects an actual `actions/checkout@v4` log region; the current workflow uses a pinned v5 checkout. Replacing the workflow name alone would not preserve that authority check.
3. It requires successful complete PR and manual test families. The observed repository variable `REVEALLINE_FULL_CI=false` prevents the release PR's full shard family; the source policy itself remains required. Focused checks cannot be relabeled as those full families.

Resolving this needs a reviewed adapter for the **actual** run topology and checkout authorities, plus real successful required-suite evidence. The existing source-identity, partition, terminal-TAP, no-skips, original-inspection and frozen-consumer checks must all remain. The early guard deliberately leaves this release blocker visible.

Validation: **57 tests passed**, zero failures/skips, across the new guard, Fastline inputs/workflow contracts, test-policy and focused-selector suites. The new four-case guard suite is registered in the publishing focused gate. Formatting, targeted lint and whitespace checks pass. No workflow was dispatched.

## Recommended next steps

1. **Finish browser acceptance and integrate the current fixes.** Use the final commit's rolling-channel build and exact public dependency receipt, then repeat the bounded player, offline/update and Studio journeys. The profile inspection is only sizing; the publisher's full assembled-directory capacity check remains required.
2. **Reconcile required release evidence before another release attempt.** Preserve the restored required policy; update the full-test adapter to the actual PR/manual/inspection topology and restore the necessary full PR gate through the canonical release owner. Exercise negative cases for wrong run, checkout, partition, source and policy before consuming a real candidate. This removes an otherwise guaranteed late release failure.
3. **Review source preservation for the next exact version.** The existing source-manifest tool created and independently verified **40,414 blobs / 3,159,483,900 original bytes**, including types/modes, at the exact starting commit. Manifest SHA-256: `6754df5dfcfe380c900edd665a7422fe42742a04aaf037065bf2dd1485e20be1`. Fastline admits that format only for the old v0.141.6 canary; this review did not broaden the admission. A version-specific reviewed decision can use the existing contract without omitting originals or uploading a multi-gigabyte TAR. It does not solve the distribution ZIP limit.
4. **Qualify the implemented lossless distribution container on the final source.** The complete 90616ad44 projection fits at 908,988,197 bytes, and the coordinated writer/readers now implement the explicit v2 contract. Retain the source-admission, malformed-stream, bounded extraction, integrity and deterministic-reproduction tests. After integration, build and independently inspect the actual complete candidate at one final merged source. The projection is not that archive, and the legacy 800 MB selector remains incompatible. Preserve complete dependency and license coverage; the rolling profile does not substitute for a full immutable release.
5. **Treat native packaging as its own decision under #865.** A supported native distribution scope, or a justified policy backed by target storage/memory measurements, is needed before staging can pass. Preserve all runtime dependencies, retained originals, licenses and radio/FPV payloads. After that decision, run actual desktop/iOS staging and full inventory/hash verification; app compilation, installation and device execution remain separate.

After these decisions, the canonical publisher can qualify **one final merged source**, freeze its own original artifacts, independently inspect every member, assemble the required evidence, and publish only after review of those concrete outputs. A human playtesting waiver does not waive source integrity, capacity, required automated suites or publication ownership.

## Physical controller availability

Two read-only OS inventories initially found **zero connected gamepads and two paired, disconnected gamepads**; the USB inventory was empty. Only device kinds/counts are retained here, without addresses, serials or unrelated device names. After the user said they would connect both controllers, the parent task observed **two DualSense controllers in the public Team settings**, assigned one to each pilot, and retained a screenshot. The user then confirmed “both controllers work”. The later [native Team controller report](team-duel-controller-native-2026-10-15.md) records a controlled Player 2 loss, retained Player 1 seat, explicit rejoin, retained paused state and a controlled live automatic-pause observation. Pairing inventory or UI assignment alone does not certify those physical-input behaviors.

## Reproduction boundary

Local source-manifest preparation used the existing `source_manifest.py create` followed by `verify`, both against the full starting commit above. Completed build sizing used `inspectBuildProject({ sourceRevision: null, publicationProfile: null })`; the subsequent `main-pages` attempt was cancelled as recorded above. No snapshot/tag/source TAR, expanded site or ZIP was created. Local detailed inventories are task-owned under `.cache/team-duel-release-readiness-20261015/`; the committed receipt retains their identities and summary, not their full multi-megabyte contents. Repeat final-profile and source-identity checks after integration. These measurements do not authorize any publication or capacity change.
