# DRAFT INCOMPLETE — public recovery navigation

This guide covers only already accepted public backup records in [`mekhovov/revealline`](https://github.com/mekhovov/revealline). **The full198 inventory and final public cutoff remain incomplete. Preservation is not complete, and the source volume is not declared safe to retire.** This is a navigation and whitelist candidate for root review; it publishes nothing.

## Start with the recorded scope

Authenticate to GitHub with access to draft backup release **414505790**, tag `fpv-development-preservation-20261016`. Obtain the exact pinned guide, index/manifest, compatible helper files and accepted receipt before selecting an asset. Retrieve by the manifest's numeric asset ID, verify its complete bytes/digest/member identities, and restore only into fresh destinations. Follow the [accepted portable-tool guide](https://github.com/mekhovov/revealline/blob/66f2a6e2d4924dc43d255967914b081b3f9c582d/authoring/fpv-development-preservation/README.md) at fixed toolset commit `66f2a6e2d4924dc43d255967914b081b3f9c582d`; the adjacent JSON catalog pins the public references and their hashes.

Use the helper's fresh capacity estimate, including downloads, extracted objects, logical copies, metadata and reserve. The full public restore helper retains a 2 GiB reserve and refuses insufficient space or overwrite. Do not relax guards or erase original evidence to obtain a pass. Restoring backup data does not run or qualify the application.

## Five preservation PR entry points

These are the supplied Draft-preservation navigation entries. Their current head, Ready or merged status was not queried; a moving PR is not an immutable final-cutoff receipt.

| Entry | Purpose |
| --- | --- |
| [1547](https://github.com/mekhovov/revealline/pull/1547) | Captured primary source and working snapshots. |
| [1550](https://github.com/mekhovov/revealline/pull/1550) | Independent evidence and original verification archives. |
| [1551](https://github.com/mekhovov/revealline/pull/1551) | Source-history preservation and public archival anchors. |
| [1552](https://github.com/mekhovov/revealline/pull/1552) | CAS backup, original-stage index and portable tooling. |
| [1556](https://github.com/mekhovov/revealline/pull/1556) | Later captured primary source snapshot. |

For source reconstruction, choose the exact archival ref/prerequisites recorded by the accepted source manifest. The [immutable original source cold-recovery acceptance](https://github.com/mekhovov/revealline/blob/9ea22e3dc5ab93e6c140a96e392bc503336d062a/docs/verification/fpv-library-preservation-20261016/source-closure-independent-review/github-hosted-original-source-cold-independent-acceptance.json) proves its captured source scope; it does not establish the final current working state or unavailable earlier ancestry. Keep unfinished snapshots separate from product admission.

## Immutable public backup records

| Record | What passed — and its boundary |
| --- | --- |
| [Original-stage index](https://github.com/mekhovov/revealline/blob/0942916a74c5ed6821e31b7d4ee34a66e97b9456/docs/reports/fpv-development-preservation-20261016/final-index/preservation-index.json) and [actual full restore receipt](https://github.com/mekhovov/revealline/blob/f3e846a92ef2605fa29210cdfd685e02d99bb481/docs/reports/fpv-development-preservation-20261016/cloud-portable-restore-38861525073/full-portable-restore.json) | Run 38861525073 restored 122,706 file paths / 20,682,624,334 logical bytes, 282 portable links and 39 Git-backed dependency files, with hash/mode/time checks. Exact index SHA256 `630438ac879a40577638e5b21706fea93b637b8a34dbc70ad3266248b2d9509e`. ORIGINAL staging scope only. |
| [Extra-public CAS coverage](https://github.com/mekhovov/revealline/blob/4c3727ef3dc36719c511cccc4fe9785a7fd7f47b/docs/reports/fpv-development-preservation-20261016/four-reviewed-public-positive-cohorts-object-coverage-003.json) and [focused003 independent acceptance](https://github.com/mekhovov/revealline/blob/4c3727ef3dc36719c511cccc4fe9785a7fd7f47b/docs/reports/fpv-development-preservation-20261016/cloud-incremental-readback-38875736494/root-independent-review/root-acceptance.json) | 40,505 positive paths / 5,142,009,238 logical bytes have object coverage through verified parts/direct identities. Focused run 38875736494 checked all 14,504 objects in its exact part. This is not a complete expanded logical-path/mode/time/link restore or final input set. |
| [21 original verification archives](https://github.com/mekhovov/revealline/blob/0959055975afe3a929c8f2c8602a6ab77488277c/docs/verification/fpv-library-preservation-20261016/archive-preservation/release-assets-manifest-21.json) | 21 original archives /436,184,309 bytes passed server and full authenticated readback checks. The manifest supplies exact asset IDs/digests. Original failed package and qualification results remain failures; byte preservation does not admit a package to the player. |
| [Explicit13-file recovery checkpoint](https://github.com/mekhovov/revealline/blob/377db4be1c493ed0e731dda4bf47d7af70b08814/docs/reports/fpv-development-preservation-20261016/explicit-public-checkpoint-v2-receipt.json) | Asset 646797088, 119,025 bytes, SHA256 `53c7db37eb7b04b9b3e87cfc6526cbe6804d3e1c2c6c428e12cf6419fcf1875a`. Exact full readback/member checks passed. It contains the named public entry/acceptance receipts and nine pinned validator files, including LICENSE/NOTICES. Its exact 13-member whitelist is in the catalog; this task did not reassemble it. |

The original-stage index binds all file records. The tool's `linkDispositionsSHA256` binds the reviewed link records only; older receipts used a different name for that same link-only digest. Do not treat it as a hash of every file node. Unknown dependencies/links remain explicit rather than recreating historical absolute targets.

## Limits and completion placeholders

The catalog is limited to the public records listed above. No broader inventory or final input set is inferred. Full198 coverage, the final public-only selection, final source/payload cutoff and final independent acceptance still need exact receipts; `finalPublicCutoffReference` deliberately remains null and all completion/safety flags remain false. A later documentation commit must not inherit a historical restore pass.

Preserve the original403 readback negatives, normally cancelled/unaccepted historical reruns, failed packages and other negative evidence. The accepted backup runs are integrity/recovery checks, not player readiness, public-storage repair, runtime/performance, native controls or physical-device acceptance. Required application CI and repository protections were not changed by this draft.

This draft used named accepted public metadata/documents only. It performed no original source/body/directory/target walk, asset download, repeated canonical API check, application execution, restoration or Git write. Root owns any later public publication decision.
