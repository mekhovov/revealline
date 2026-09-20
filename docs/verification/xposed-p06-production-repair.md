# P06 production metadata repair — not release readiness

Original failed gate: hosted35523571497 at exact
`0e04d970b5102cbd8bf969ac20629568bc7861ed`. Validation, lint, formatting and
native syntax passed, but production reproduction stopped before test shards.
Preserve that failure; neither P06 nor this correction is fully qualified.

## Minimal changed input

Compared with qualified P05 `8a970b07`, only `game/presentation/host.mjs` changed
among the five production recipe input groups. Screens, motion, effects and
audio aggregate hashes remain identical. The host change belongs to the reviewed
theme ownership work, not Fractured Grid art or physics.

| Pin | Prior | Current |
|---|---|---|
| Host SHA-256 | f63aae713bad754ca826fa3d7c0ea2455db4f5d56b55882cd2ef6f196ec13798 | 1961ae62d54d4e558ba3f1631ecafbee0a98483752e9aee727cd238bbe02f9eb |
| UI recipe aggregate | c4bf0ef9888d0985666b936e8cc1fa4055fac9959ea0a4c356d3db4efdd99766 | 2d4977d93b692f26304a301b84785e8f6da7a036322caf29593a7998b6b16547 |

## Bounded generation

The release owner authorized only metadata generation in the isolated repair
branch. The actual `createFieldKitProduction` factory read exact frozen Git
inputs through a scoped read-only adapter, without hydrating source artwork.
Its output passed through the existing history, portable-bundle and presentation
compiler APIs. No generator, policy, source-review declaration or gate was edited.

The immutable history advances fpv34→fpv35, appending24 UI recipe revisions.
Every prior asset record is preserved. All127 original payloads are byte-identical
and the generated CSS is byte-identical. The factory/history operation is
idempotent against its resulting document. Only the portable ledger and the
compiled manifest/runtime/studio metadata files are changed; no asset files,
full build, archive, deployment or cleanup operation is involved.

| Output | Bytes | SHA-256 |
|---|---:|---|
| Original ledger | 7062205 | 8254c62d3093c8a7a6086387b7c0f15aaa729a94f562991142edd2687183c01e |
| Candidate ledger | 7096921 | 46ee895c43851ef075dc623bb58b83b35d1e6d0ec1d14113e280bf71166de287 |
| Compiled manifest | 27214 | f5a9a9e3899b95088c68ef4b840aba5cfedcafc50fc539ede2ecd973897a5eb4 |
| Compiled runtime | 947317 | 605b8182c95b5aa0b94637024838cefdea9a007b19ddf89b7905e24314f25549 |
| Compiled Studio | 3531396 | eb33b4fbb6850b16bca9b71a2a466fedc84e09c13a1e0ddd31f0700c99257238 |

## Gates deliberately still open

The24 affected UI recipes are explicitly `source`, not `reviewed`. The actual
readiness checker rejects them. Existing source-level theme tests and scoped
browser observations are not silently reused as a comprehensive recipe review.
An independently pinned functional/native review must justify a later reviewed
successor while retaining fpv35 and every earlier revision.

The exact CLI production `--check` passed in hosted35524398709 at e5ff21b3.
Validation, lint, formatting and native syntax also passed. Readiness correctly
rejected24 source-stage UI recipes; full shards and freeze were skipped.
Reproduction is not review. Full source shards, accepted-baseline composition,
release-owner promotion, public byte/native checks and human phase acceptance
remain separate requirements.
