# Studio validation recovery — 22 September 2026

Closed PR242 was not merged when its parent branch disappeared. This recovers its single feature commit `0c241f73def4755627d73b66c1aca17e8c3f32e9` onto the accepted integration cutoff `64ec9fd2e5688f4248fe005ac6a47c0c1394ea9e`.

Seven non-guide postimages match the original feature exactly. The only conflict was at the end of the maintainer guide: the current guide was retained verbatim and the feature's exact appendix added. No release version was allocated or immutable source changed.

The [qualification receipt](qualification.json) pins original logs for13 passing checks per Node20.19.5 and22.22.2 across the two complete affected files. Scoped ESLint, formatting and staged whitespace checks pass. Independent review and native observations from the original candidate remain separately attributed in [the feature description](../../studio-validation-labels.md).

The integrated source still needs the final version, all six gates/build, native portrait/short-landscape validation-label checks, immutable release, Pages and public verification. Draft status and inherited package version do not constitute a release.

## Integrated native follow-up

Exact source `46dcdcdb1d23237d74af90dba76add37e5a0fae8` passed the actual empty timed-form submission at320×568 and ID-only submission after rotation to844×390. Native validation kept its message and chosen field. The ID label began at8.09px; the Anchors label began at7.78px. Shift+Tab restored Effect with its label visible. Project JSON remained byte-identical and neither invalid submission applied a schedule.

[Native receipt](pr258-native-qualification.json) binds173 responses/173 paths with zero mismatches and no observed console warnings/errors. All served source bytes were compared to that exact commit. The owned tab/server were closed and viewport override reset.

This closes the scoped final-integration portrait/landscape label check. Physical devices/controllers, actual zoom, screen readers, other Studio forms, versioned full-source qualification and public delivery remain separate.
