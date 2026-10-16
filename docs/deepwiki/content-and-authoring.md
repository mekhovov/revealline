---
id: content-and-authoring
title: Content and authoring
importance: high
filePaths:
  - game/content-design/project.mjs
  - game/runtime-content-provider.mjs
  - game/editions/bootstrap.mjs
  - authoring/company-studio/model.mjs
  - authoring/company-studio/README.md
  - authoring/asset-studio/README.md
  - authoring/asset-studio/studio.mjs
  - game/presentation/model.mjs
  - game/presentation/theme-system.mjs
  - game/presentation/runtime-transfer.mjs
  - scripts/compile-content-project.mjs
  - scripts/compile-edition.mjs
  - scripts/compile-presentation.mjs
  - game/optional-practice-catalog.mjs
  - scripts/build-optional-practice.mjs
relatedPages:
  - architecture
  - runtime-data-flow
  - persistence-and-replays
  - operations-and-configuration
---

# Content and authoring

RevealLine represents authored gameplay as validated content projects and selects company content through an edition provider that feeds the ordinary Solo host. Editions supply content and presentation; the shared host owns the update loop, difficulty implementation and input controller. ([game/content-design/project.mjs:147](../../game/content-design/project.mjs#L147), [game/runtime-content-provider.mjs:82](../../game/runtime-content-provider.mjs#L82))

### Projects and editions

`ContentProjectV1` groups maps, missions, campaigns, packs and assets while pinning policy, actor and difficulty catalogs. Compilation freezes a resolved registry and resolves every declared mission mode against each difficulty preset; the CLI explicitly reports `compiled-candidate-not-playtested` and `readyForRelease: false`. This makes compilation a structural admission step, not evidence that an authored route has been played successfully. ([game/content-design/project.mjs:149](../../game/content-design/project.mjs#L149), [game/content-design/project.mjs:333](../../game/content-design/project.mjs#L333), [scripts/compile-content-project.mjs:164](../../scripts/compile-content-project.mjs#L164))

The runtime provider selects an edition from the URL or compiled document identity, rejects a different audience in an installed edition, and can load a registered retained presentation. Bootstrap reads the selected campaign projects, rejects incompatible gameplay catalogs or conflicting immutable records, and validates lesson, reward, localization and presentation inputs. The provider returns cloned startup catalogs, themes, lessons, rewards and edition context to its caller. ([game/runtime-content-provider.mjs:94](../../game/runtime-content-provider.mjs#L94), [game/runtime-content-provider.mjs:120](../../game/runtime-content-provider.mjs#L120), [game/editions/bootstrap.mjs:20](../../game/editions/bootstrap.mjs#L20), [game/editions/bootstrap.mjs:96](../../game/editions/bootstrap.mjs#L96), [game/runtime-content-provider.mjs:189](../../game/runtime-content-provider.mjs#L189))

Edition compilation selects brands, campaigns and transitive asset dependencies into a public catalog, reads their declared files, and projects only relevant presentation themes. Runtime startup independently checks approved/public assets, a 64 MiB presentation budget and exact mission-artwork pins; reveal-only originals can be deferred unless another startup dependency needs them. ([scripts/compile-edition.mjs:104](../../scripts/compile-edition.mjs#L104), [scripts/compile-edition.mjs:147](../../scripts/compile-edition.mjs#L147), [scripts/compile-edition.mjs:169](../../scripts/compile-edition.mjs#L169), [game/runtime-content-provider.mjs:26](../../game/runtime-content-provider.mjs#L26))

```mermaid
flowchart LR
  Draft[Company source draft] --> Validate[Studio validation]
  Validate --> Files[Catalog and declared JSON]
  Files --> Compiler[Edition compiler]
  Compiler --> Build[Selected edition files]
  Build --> Bootstrap[Edition bootstrap]
  Bootstrap --> Provider[Runtime content provider]
  Provider --> Host[Shared Solo host inputs]
```

**OBSERVED:** validation, file selection and provider handoff boundaries; this diagram omits publishing and player storage. ([authoring/company-studio/model.mjs:194](../../authoring/company-studio/model.mjs#L194), [scripts/compile-edition.mjs:147](../../scripts/compile-edition.mjs#L147), [game/editions/bootstrap.mjs:70](../../game/editions/bootstrap.mjs#L70), [game/runtime-content-provider.mjs:219](../../game/runtime-content-provider.mjs#L219))

### Authoring surfaces and presentation formats

Company Studio edits identity, artwork roles, actors, campaigns and learning, then exports a `revealline-company-source-draft.v1` packet. The validator requires every declared JSON source and rejects duplicate or undeclared paths; retained presentation JSON preserves its original text and undergoes hash verification. Binary originals stay in the source workspace. Whole-game preview is compiled through the CLI and checked against the applied draft before opening; the documented workflow does not publish a release. ([authoring/company-studio/README.md:3](../../authoring/company-studio/README.md#L3), [authoring/company-studio/model.mjs:194](../../authoring/company-studio/model.mjs#L194), [authoring/company-studio/model.mjs:241](../../authoring/company-studio/model.mjs#L241), [authoring/company-studio/README.md:15](../../authoring/company-studio/README.md#L15))

Asset Studio manages theme/media workspaces. Its `.rltheme` export preserves editable history, while `.rlruntime` exports a compiled presentation plus a candidate descriptor and selected asset bytes. Runtime transfer validates the candidate against its source presentation; procedural SIM resources remain installed-engine dependencies. Artwork collection `.rlart` drafts are separate from mission registration. ([authoring/asset-studio/README.md:10](../../authoring/asset-studio/README.md#L10), [authoring/asset-studio/studio.mjs:1488](../../authoring/asset-studio/studio.mjs#L1488), [game/presentation/runtime-transfer.mjs:55](../../game/presentation/runtime-transfer.mjs#L55), [authoring/asset-studio/README.md:33](../../authoring/asset-studio/README.md#L33))

Two similarly named presentation layers deserve attention. `presentation/model.mjs` validates revisioned slots, assets, themes, collections and selections. `presentation/theme-system.mjs` separately validates `ThemeFamily.v1` references across interface/arcade/SIM domains and accepts `InterfaceTheme.v1` and `InterfaceTheme.v2`; its resolver applies interface and accessibility choices. ([game/presentation/model.mjs:578](../../game/presentation/model.mjs#L578), [game/presentation/theme-system.mjs:411](../../game/presentation/theme-system.mjs#L411), [game/presentation/theme-system.mjs:454](../../game/presentation/theme-system.mjs#L454), [game/presentation/theme-system.mjs:561](../../game/presentation/theme-system.mjs#L561))

The presentation compiler verifies assets, writes hash-derived media paths, `theme.css`, `runtime.json` and an inventory manifest; normal authoring output also includes `studio.json`. Its explicit `playerOnly` projection omits that authoring document and supports retained runtime hashes. ([scripts/compile-presentation.mjs:41](../../scripts/compile-presentation.mjs#L41), [scripts/compile-presentation.mjs:81](../../scripts/compile-presentation.mjs#L81), [scripts/compile-presentation.mjs:113](../../scripts/compile-presentation.mjs#L113), [scripts/compile-presentation.mjs:163](../../scripts/compile-presentation.mjs#L163))

### Optional practice boundary

Optional practice uses a small public `practice/index.json` launcher catalog rooted outside edition/release directories. Reading it does not fetch packages or open player storage. The separate package builder applies an explicit policy and emits an archive with `core: false`; its manifest labels development output or required release qualification. ([game/optional-practice-catalog.mjs:3](../../game/optional-practice-catalog.mjs#L3), [game/optional-practice-catalog.mjs:64](../../game/optional-practice-catalog.mjs#L64), [scripts/build-optional-practice.mjs:184](../../scripts/build-optional-practice.mjs#L184), [scripts/build-optional-practice.mjs:297](../../scripts/build-optional-practice.mjs#L297))

### Evidence

- [game/content-design/project.mjs:147](../../game/content-design/project.mjs#L147): shared content compiler boundary.
- [game/editions/bootstrap.mjs:70](../../game/editions/bootstrap.mjs#L70): selected edition loading.
- [authoring/company-studio/model.mjs:194](../../authoring/company-studio/model.mjs#L194): complete source-draft contract.
- [game/presentation/runtime-transfer.mjs:89](../../game/presentation/runtime-transfer.mjs#L89): runtime transfer versus authoring history.
- [scripts/build-optional-practice.mjs:184](../../scripts/build-optional-practice.mjs#L184): separate optional packaging.

### Coverage and limitations

Queries expanded around `compileContentProject`, `loadRuntimeContentProvider`, `source-draft`, `ThemeFamily`, `rlruntime` and `optional-package`. Fifteen evidence files received focused reads, following validators and immediate callers. Binary artwork, every campaign, simulator internals and the entire editor UI were not audited. Browser behavior, route playability, content accuracy and release qualification remain **UNVERIFIED** by this source-only scan.

### Related

[Architecture](architecture.md) · [Runtime data flow](runtime-data-flow.md) · [Persistence and replays](persistence-and-replays.md) · [Operations and configuration](operations-and-configuration.md)
