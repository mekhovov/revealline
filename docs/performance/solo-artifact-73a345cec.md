# Repaired Solo package — 18 October 2026

[Appearance run 39099979283](https://github.com/mekhovov/revealline/actions/runs/39099979283) succeeded for source `73a345cec696d7789198cf295ca5c37b17ca0e71`, tree `ea30e68636b3342f8e60664a79d425e11e27ff1e`. Its declared 118-file gate passed **1,756/1,756**, with no failures, cancellations or skips; the four prerequisite jobs passed **624/624**. The production build completed in 9m14s after the 25m02s gate. These are source/build results, not native performance qualification.

| Resource         | Exact binding                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Full artifact    | `12127570566`                                                                                           |
| Outer archive    | 1,094,639,407 bytes; SHA-256 `6d93e34b3372e24f1f010bb630d7d7b688fdbc8a1280b3f3a9945e99ac171e64`         |
| Inner archive    | 1,075,807,617 bytes; SHA-256 `17d7135c4d16693f0ddb5ee655d6552fdedc18ef7add72aefa7d8e39a7b24a54`         |
| Manifest         | 529,292 bytes; SHA-256 `d16a636797b4269357cb6302211c71503819b0ca7ae333d244587cee7d159d93`               |
| Compact artifact | `12127316659`; 37,136 bytes; SHA-256 `f520c7e8183310822b43a6a2b7c5126c21d92602d2ac0eecd1b2c9b7e7190e67` |

The compact archive's five members were checked for CRC and SHA-256 and rebound to current producer/job/artifact API records, exact Git source/tree and required test policy. All four prerequisite receipts were independently retained and verified. The completed preview log is 819,889 bytes, SHA-256 `298e8f7d6fcaf606eab04051343c656a600fa18254374b774755926eecb809ff`; its final TAP summary supplies the actual count above. Local evidence is under `.cache/solo-followup/73-package/` and `.cache/solo-followup/regression-ci-73/`.

Only compact metadata and bounded logs were downloaded locally. Every hosted consumer must still verify the full archive, member inventory, sources, workers, offline closure and content-security policy before observation. No native result is inferred from metadata acceptance. Preserve the earlier de332 package and all its failed observations.

[PR #1579](https://github.com/mekhovov/revealline/pull/1579) subsequently merged as `bbd56e6fcd8f20113ccb168660d5e05d0781e1e3`. That merge also contains the independent four-file FPV repair from PR #1580. This source73 preview is distinct from the merged main and its Pages payload; neither identity may be silently substituted. The [living plan](solo-performance-followup-plan.md) tracks exact publication, browser observations and remaining qualification.
