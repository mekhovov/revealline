# Latest-main integration at b2f251da

Merge `6bed7bf5a6933b77d56803500637cdbc587613d2` incorporates exact upstream
`b2f251dac0d762d476f725b1bc601a2d6d5485a5`, following the earlier main integration
at `87aca9092`. Its tree is `0cb7b32b23310bb8c6fdd9626d26ddf092c8780f`; the upstream
tree is `76384fee18af8f50537f75e37b5c4f327792462b`. This record describes source
integration and Node correctness/content checks. It is not browser performance,
native-package, physical-device or sustained-play qualification.

## Integrated scope

The merge adds upstream FPV tuning and advanced simulation, delivery, native-host
and export support. Comparing the merge to its first parent finds no changes to
Solo's `game/app.mjs`, `game/ui/`, `game/audio.mjs`, `game/audio/` or `game/core/`.
Shared `game/platform.mjs` and `game/build-config.json` do change: the platform
adds bounded text export and updates the complete-backup export envelope; the
build configuration admits the new optional FPV modules. These shared boundaries
therefore receive their own regression checks.

The company candidate workflow preserves both changes from its parents: the
prior explicit merge-source checkout and artifact/source identity for optional
integration, and upstream's conditional installation of pinned FPV persistence
test dependencies. The separate company candidate retains its exact-head
identity. Neither integration artifacts nor this merge substitute for a declared
Solo production package.

## Checks and source attribution

The parent-run regression suite passed **57/57**, with no failures, skips or
cancellations, under Node 22.22.2 with test-file concurrency 2. Its eight files
cover the platform, iOS bridge, desktop policy, complete backup, terminal recording
export, optional/core tools boundary, sparse publisher imports and source identity.
The retained receipt lists the exact invocation. The parent recorded launch at
`6bed7bf5a` and terminal exit zero in session 20639. This review independently read
back the complete TAP and verified that all eight test files still byte-match
that launch revision; it does not claim a second execution.

The complete `npm run validate` invocation passed under Node 22.22.2 in
**152.701 seconds**, exiting zero within its 300-second and 4 MiB output bounds.
It checked 13,651 localized messages, 9,049 references and 3,336 admitted files;
literal references were valid. The seven emitted navigation warnings remain in
the retained log rather than being reported as absent. Canonical presentation,
optional workers, artwork/audio projections and industrial generated content all
passed their checks. The optional reaction projection specifically reports
**32 modules, 24 recordings and 918,810 bytes**, verified byte-identical after the
cue-deadline fix `80a0ab711`.

Validation started with a clean working tree at
`25898dd0a78369afeaf9e0b197191e80cff37ef6` (tree
`bffd2b8f34b077bccdb38c361f9fb512720d1ff3`, game tree
`5052c25355ba1cb8908df0c2fa54b6105d818bb5`). HEAD and all 11 captured direct
validator/package input files remained unchanged. Other agents edited the
published-cue implementation/tests and qualifier diagnostics while this command
ran; the receipt preserves the complete ending dirty-file list. Therefore this
is a successful shared-worktree content check, **not an immutable final-runtime
validation**. A later validation after those changes settle must retain its own
source identity. No full lint, browser, build or audio download was run for this
documentation task.

## Frozen comparison and remaining confirmation

The planned diagnostic comparison named candidate
`c9e637ad81fadf49caec884155d1bd0c2496c59c` against the normal production baseline
`8b01991942dc764b8aa4726851699ce1985e53ae`. However, candidate Appearance
[run 38998342861](https://github.com/mekhovov/revealline/actions/runs/38998342861)
failed before producing a usable candidate package. The planned `c9`/`8b`
consumers are therefore **held and unusable**, not an ongoing comparison.
Those historical source identities remain fixed; the next successful candidate
requires a prospective declaration with its actual source and verified artifact.
The main merge cannot substitute runtime bytes or promote earlier results.
Historical `3ad`/`b117` observations and the failed first-eight result also retain
their original identities and status.

The subsequent published-cue read-deadline fix is commit
`80a0ab7114d6b055cdb1d667be1e1c5437bb5c73`. It requires its own verified production
artifact and native audio confirmation. The [cue evidence record](solo-published-cue-read-deadline.md)
describes its separate causal tests. Current content checks and the independent
[native MP3 delivery control](solo-native-mp3-control-20261017.md) cannot supply
that application confirmation or qualify iPhone 17 Pro Safari or Steam Deck OLED
Chrome.

## Retained evidence

Files below are under `.cache/solo-followup/main-b2-integration/`. The readback
receipt preserves both parent-provided execution attribution and independently
verified input/output hashes.

| File                           | Result                                                                           |  Bytes | SHA-256                                                            |
| ------------------------------ | -------------------------------------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `platform-source-tests.tap`    | 57 passed; no skipped or failed tests                                            | 13,350 | `92a201ec108ede529f25b3ee1877d165730733dd9c77d70cefe4e1975c515fac` |
| `integration-readback-v1.json` | Exact merge/parents, workflow checks and eight unchanged test identities         |  3,483 | `839cbfdb795f2545159f2fe1a9fb4d34d731e76b7ba6d10c825fffc38783df56` |
| `validate-25898dd0a.log`       | Complete validation passed; navigation warnings retained                         |  3,885 | `b97d746fd9f5dea44a7c923ab8f15c57891e248a46952fc671335655e13ffe50` |
| `validate-25898dd0a.json`      | Command/bounds, start source, direct input hashes and concurrent-edit limitation |  2,937 | `924bf6afcad66e487a9311410f8c8b642ba0fc4876117dbb180817ee649a4b57` |
