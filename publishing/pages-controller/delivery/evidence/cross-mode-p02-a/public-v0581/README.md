# P02-A · v0.58.1 scoped acceptance

**P02-A is complete within the scope below.** The coordinating task accepted the existing sound-control work and its Team capability-note correction after the independent review passed. [Play v0.58.1](https://mekhovov.github.io/revealline/releases/v0.58.1/site/game/) · [Acceptance record](acceptance.json) · [Independent review](independent-review/review.json).

## Accepted scope

Shared master sound controls govern the existing Solo, Versus, Studio preview and story producers, with the observed transport, mute and preference behavior retained in the [v0.58.0 audio evidence](../public-v0580/README.md). The v0.58.1 correction keeps Team's permanent capability explanation separate from transient storage feedback after mute/volume changes, reload and paused edits. Team currently has no audio producer; these controls do not imply a Team soundtrack.

The exact [source qualification](../../../../evidence/current-v0581/source-qualification.json) records 4,333 passing tests across 384 files in each complete hosted family, the six source gates, production reproduction/readiness and ordinary build. Both families repeat the same cases. [Source PR 70](https://github.com/mekhovov/revealline/pull/70) freezes `c93019a344f6f4c6ac03940c77ea09c81122d911` / tree `f6055cbcba92d45ef1da2b5d16e7e4f1158c8d2a`.

[Publication PR 71](https://github.com/mekhovov/revealline/pull/71) produced publisher `a1a5d0c5295196024af1a158c53acedc2f817c1a`, [Pages run 35060819275](https://github.com/mekhovov/revealline/actions/runs/35060819275), deployment `6474632693`. The complete public audit verified **2,530 files / 637,630,752 bytes**, with 2,530 attempts and no errors, retries or skipped rows. Post-audit authorities and all nine immutable release-asset descriptors remain pinned in the original evidence.

The public Team correction has 36 original files across 14 correlated observations: keyboard preference edits, reload, paused edits, explicit Back and desktop/portrait/short-landscape browser sizes. The clipped note and later successful inner scroll remain separate observations. The independent review rehashed every original and reconciled every public row.

## Additive evidence and historical records

- [evidence.zip](evidence.zip) and [manifest.json](manifest.json) preserve 477 originals / 11,130,779 bytes: the public audit, native correction, source/publication PR and merge records, release creation/upload/publication receipts, command outputs and unsuccessful observations. The ZIP is 3,158,161 bytes, SHA-256 `cbe7385ebb0beebff0c60f1e009d1cc1e3b164e37514ca3085738cd487637896`.
- [Preparation README](preparation/README.md), [preparation receipt](preparation/receipt.json) and the original manifest retain `phaseAcceptance: false` and review-pending language. They describe the earlier packaging operation; this new wrapper and [acceptance.json](acceptance.json) record the later coordinating decision. No original is relabelled.
- [Independent review originals](independent-review/review.json) retain their two helper revisions and failed-attempt explanation. Their `phaseAcceptanceWritten: false` records the reviewer's role, not a reversal of the coordinating task's later acceptance.
- [Original-copy manifest](originals.json) pins every copied outer file. The separate [source-qualification evidence ZIP](https://github.com/mekhovov/revealline/releases/download/v0.58.1/source-qualification-evidence.zip) remains the immutable source proof. Redundant large envelopes are listed as omissions in the original bundle manifest; no game distribution or source TAR was copied here.
- The [v0.58.0 review](../public-v0580/review.json) remains `REQUIRES_CORRECTION`, with its original limitations and unsuccessful observations. This successor closes its Team explanation defect without rewriting that historical report.

## Remaining work

P03 is next: complete native navigation and focus restoration. Natural story end/Skip focus remains P03/P07; scrolling and responsive presentation remain P03/P05. P02-B still owns Team audio production, complete custom playlists, album listening and offline custom-media acceptance. P18 retains physical controller/touch and full browser qualification.

This acceptance does not assert acoustic listening, measured native media volume, iPhone attenuation, a complete Team round, private checkpoint equality or fresh public storage-refusal/offline tests. Browser viewport observations do not certify physical devices. The frozen game version and historical delivery report are unchanged by this metadata addition.
