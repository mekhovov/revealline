# v0.85.0 publication handoff

The stable game release was published at 2026-09-22T21:46:43Z as release `394140126`. Its source is `f6e592bacda85db5efcf68f5be3ad2240073b661`, tree `15dcbb22f845ad9825316c54321efa22e5a0054e`, annotated tag `398c3d07d840b35c7dbc92ec1a63a04da9c22591`. This publishing controller does not rebuild or rewrite that game.

## Release authority

- Actual merged-source qualification/freeze: `35786184530`, artifact `10720876111`, SHA-256 `92b7490e52d9939cbee537e412c19f45883c9c38c7199aa6143cde3885cd7ec8`.
- Authoritative inspection: `35787270298`; successful nine-asset upload: `35788178276`.
- Distribution: 591,017,758 bytes, SHA-256 `22935ce25164a6239301597cbdba58aa0a9a918432f0e16aadd212ab45e71bbc`.
- Source archive: 1,610,905,600 bytes, SHA-256 `067bc28e478196fd085e551108d699388ea7e42bae1918ec01e690f6e31dc5ef`.
- Qualification: SHA-256 `576ca7669096c514df3ada64fef6e5110e097166b5ad494093674e0da9b47601`.
- Failed no-write upload `35787859424` and duplicate cancelled runs remain preserved. They are not passing publication evidence.

Automated suites and extended manual journeys are waived/deferred under the explicit temporary user policy, not passed. Builds, exact source/tag/asset pins, archive preservation and public availability remain required. GitHub reports `immutable: false`; release bytes are preserved by policy and verified hashes, not a claim of platform-enforced locking.

## Scope and pending acceptance

Append v0.85.0 without changing any earlier catalog row or original metadata. Archive53 now preserves v0.84.0 at infrastructure `9ebb2c397b6db59561129147b8758ad24e0489c2`, production `35789096805`, deployment `6601503691`. Complete public audit `35789400309` verified all 1,085 files / 590,842,992 bytes with zero failures, retries or skips; scoped native availability passed at receipt SHA-256 `5be6a85039a31a4682df1cf02d79092dd8aec541514812dfdf9065def7929109`. That admission claims historical availability, not extended gameplay/offline/device acceptance. Keep all earlier archive allocations/admissions and every historical route. Main preview, deployment, complete public byte inventory and scoped native availability are pending until their exact receipts are recorded; a source release is not a Pages acceptance.

## Bounded deployment speed improvement

The deploy job checks out only four files: the release-policy entry, its metadata and archive-helper imports, and the exact publication selector. The independent static review found no other runtime imports or local file reads in this execution path. The job retains the exact `github.sha`, shallow history, pinned Node runtime, fresh highest-stable-release check, permissions, serialization and Pages action. Assembly and all artifact-byte checks are unchanged.

The preceding v0.84 deployment spent 281 seconds in its second full source checkout; earlier runs varied, so no fixed time saving is promised. This change reduces redundant checkout content without removing a gate. Future policy imports or file reads must be included in this explicit sparse list. Tests are not claimed to cover this change; exact-head preview and production runtime remain required.
