# Studio validation recovery — 22 September 2026

Closed PR242 was not merged when its parent branch disappeared. This recovers its single feature commit `0c241f73def4755627d73b66c1aca17e8c3f32e9` onto the accepted integration cutoff `64ec9fd2e5688f4248fe005ac6a47c0c1394ea9e`.

Seven non-guide postimages match the original feature exactly. The only conflict was at the end of the maintainer guide: the current guide was retained verbatim and the feature's exact appendix added. No release version was allocated or immutable source changed.

The [qualification receipt](qualification.json) pins original logs for13 passing checks per Node20.19.5 and22.22.2 across the two complete affected files. Scoped ESLint, formatting and staged whitespace checks pass. Independent review and native observations from the original candidate remain separately attributed in [the feature description](../../studio-validation-labels.md).

The integrated source still needs the final version, all six gates/build, native portrait/short-landscape validation-label checks, immutable release, Pages and public verification. Draft status and inherited package version do not constitute a release.
