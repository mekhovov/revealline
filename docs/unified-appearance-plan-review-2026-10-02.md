# Unified appearance: completed work, remaining work, and proposed priorities

Follow-up: the user approved proceeding with the quality-first order. The
[implementation follow-up](verification/appearance-quality-2026-10-02/README.md)
records the subsequent fixes and verification. The assessment below is preserved
as the review snapshot, including gaps that the follow-up has since closed.

Review date: 2026-10-02. **Draft for user review and rebalancing.** This report
does not change the approved execution queue or authorize a release. No production
code was changed during this review. It assesses the current working tree and
retained evidence; tests were not rerun for this report.

## Assessment

The shared appearance framework is implemented, with eight coordinated installed
theme families and substantial local verification. The requested whole-game art
quality and release acceptance are **not complete**. The largest functional gap
is the last step from an edited Studio theme to a usable custom community default.

Earlier wording such as “eight complete built-in families” and “production
families” should be read as **eight functional selectable families**, not eight
independently produced and fully approved asset collections. This review supplies
the more precise completion boundary.

The eight families are Industrial Workshop, Vyshyvanka, Dnipro Porcelain, Tryzub,
Desktop 98, DOS Navigator, Orchard Workshop, and Neon Ruins. Legacy appearance
remains available. Industrial, Ukrainian, desktop, terminal, wood, and neon
treatments use the same framework. Adding more architecture should not be the
default next phase: the existing framework now needs focused completion and use.

## Original milestone reconciliation

| Original milestone | Current status | Completed | Remaining exit conditions |
| --- | --- | --- | --- |
| 1. Framework proof | Mostly implemented; acceptance open | Versioned contracts, legacy adapters, resolved tokens, component specimens, calibration renderer, representative game/SIM experiences, Studio edit/export/reload, light/flat theme examples. | Art/readability approval of the representative experience; retained independent conformant-viewer comparison for exported production assets. The original complete quality gate is not established by current evidence. |
| 2. Complete interface release | Broadly implemented; not released | Unified Appearance control, material recipes and paired colors, first-paint integration across 45 public entrypoints, menus/game/tools/SIM adapters, accessibility overrides. | Named screen/state inventory with visual review; remaining Company Studio localization; complete input/language/accessibility journeys; classify unexplained wider-suite failures. |
| 3. Complete SIM collection | Procedural role coverage implemented; art and device qualification partial | Eight environment families, shared drone/gate/pad/scenery/actor/material/effect bindings, previews, recordings, optional packages, quality presets and resource disposal. | Fixed-route near/far/grazing-angle review, shimmer and sightline checks, target-device performance; finish any approved production asset upgrades. Studio does not yet author arbitrary SIM collections. |
| 4. Arcade asset collection | Shared treatment implemented; bespoke production partial | Cached palette/material/mask treatment for 35 exact built-in sprite roles; original alpha, frames, footprints and custom content preserved. | Review sprites at actual gameplay size and speed; improve selected roles needing distinct art. Replace remaining family-ID assumptions with declared capabilities before expanding creator-defined collections. |
| 5. Subsequent collections | Brought forward as functional families | Desktop 98, DOS and Ukrainian/other families are already selectable across the shared runtime. | Their individual art direction and complete acceptance remain open. Detailed realism remains later work. New levels/pictures/stories are separate content work. |

Collection breadth expanded before the original first-milestone quality gate was
fully demonstrated. Keep that useful implementation, but restore an explicit
representative approval step before committing to bulk art production.

## Completed engineering and what it means

| Area | Implemented result | Boundary |
| --- | --- | --- |
| One Appearance control | Choose a family, Apply complete theme, optionally customize mission artwork and decorative detail. Complete Apply coordinates compatible UI/Arcade/SIM defaults while keeping accessibility preferences. | Independent advanced choices still exist intentionally. Arcade artwork means the visual treatment of gameplay sprites/materials, not the level's revealed picture or story. |
| Shared colors and component behavior | Foreground/background pairs, semantic states, focus independent of selection/error, matching icons, textured nine-slice centers, common typography and sizing. | Passing token checks does not establish every rendered text/background combination. |
| Legacy and preferences | Older theme documents/readers, existing preference migration, recoverable unavailable choices, explicit personal choice over contextual defaults. | Original appearance remains supported; legacy screen stability needs continued regression coverage. |
| Safe application | Resources are prepared before atomic acceptance; failed or superseded loads retain the accepted presentation. Campaign adoption commits interface and Arcade appearance together. | Current tests cover identified cancellation/context races, not every possible application integration. |
| Community/campaign defaults | Versioned cosmetic revision pins; campaign → community → application fallback; personal choice wins. Local Company Studio draft editing and compiled startup hints work. | Defaults currently select installed families. No shipped community default rollout was established by this review. |
| Independent Studio workspaces | Create, duplicate a selected snapshot, recover migration, import as a new identity, explicit replacement, inspect, preview, edit/save/reload/export. | These operations are implemented, but they do not publish a customized workspace as a new installed family. |
| Theme exports | Editable `.rltheme` history and compact `.rlruntime` snapshot/dependency inventory; actual Arcade and SIM calibration previews. | Procedural runtime recipes and SIM/Arcade collections remain dependencies of a compatible installed engine. This is not arbitrary custom-model installation. |
| SIM switching | Separate interface/world choice, Follow game/Authored/specific collection, first-successful-arm freeze through disarm, adoption at retry/new flight. | Accessibility remains immediately adjustable. Gameplay geometry, scoring, physics and proof identity remain outside theme inputs. |
| Recordings | World appearance in copied course theme metadata; Academy appearance in separately validated wrapper metadata; exact references and missing-asset fallback. | Representative replay/proof checks and all-eight pin round trips exist; exhaustive replay combinations do not. Old SIM revisions need a retention policy before future collection upgrades. |
| Imported scenery | Explicit revision-specific material bindings affect opted-in nodes; unbound content retains authored materials. | Creator-owned geometry is not automatically redesigned. |

## Concrete incomplete work

1. **Custom Studio theme → community use.** Asset Studio's configure-defaults
   handoff forwards its installed base family. Company Studio rejects unknown
   family references. Editing Porcelain colors and exporting them therefore does
   not yet make that edited candidate an assignable community theme. Extend the
   existing curated registration/publication path to accept an immutable candidate
   and verified dependencies. Prove the same candidate works in two unrelated
   communities, with personal overrides, offline use and exact revision retention.
   Arbitrary player file installation is a separate, still-deferred feature.

2. **Whole-game visual acceptance.** Shared styling reaches many pages, but the
   retained review is sampled. Finish a visible checklist spanning startup/loading/
   errors, home, settings, mission library/brief, HUD, pause, results/rewards,
   dialogs, collection/replay, multiplayer, community pages, all creator tools,
   SIM launcher/hangar/flight/editor. Inspect default/hover/pressed/selected/
   disabled/error/focus combinations and actual text over the least contrasting
   background region. Keep authored pictures, logos and historic specimens
   distinct from application chrome when deciding whether a difference is a bug.

3. **Localization and accessibility completion.** The new Company Studio
   appearance-default section contains hardcoded English headings, descriptions,
   options, buttons and errors. Move those into the existing catalogs. Then review
   complete English/Ukrainian journeys, long labels, narrow layouts, Plain/Large,
   high contrast, ornaments Off, reduced effects, keyboard and real touch/controller
   input. One combined emulated accessibility case is useful but insufficient.

4. **Art quality beyond coverage.** UI material families use a shared 48px
   procedural SVG nine-slice system. Arcade adapts 35 existing sprites. SIM has
   deterministic 128×128 color textures and roughness/metalness treatments, plus
   bounded fittings/markings/scenery, largely on shared meshes. These are actual
   distinct treatments, but premium art quality is not established by role counts.
   Review Industrial first, then Vyshyvanka and Dnipro, and produce bespoke assets
   only where the review identifies a benefit. Unique geometry for every family
   is not a prerequisite for a consistent design system.

5. **Production pipeline qualification.** Pinned Blender/glTF Transform/Khronos
   tools, supported formats and theme export conventions exist. A complete themed
   source-mesh library and retained exported-asset comparison in an independent
   conformant viewer are not demonstrated. Normal-mapped bevels currently exist
   in the calibration specimen, not a production-wide normal-map rollout. A
   representative drone, gate, pad, vehicle, ground and wall set should establish
   the reviewed pipeline before bulk production. Detailed realism remains optional
   later scope rather than a prerequisite for the first textured release.

6. **Performance, flight readability and release baseline.** The render matrix
   does not prove readable signs at speed, near/far orientation cues, grazing-angle
   quality or absence of temporal shimmer. Local frame cadence is not proof of the
   ≤10% p95 regression target on lower-end devices. Classify the interrupted full
   test run's unexplained failures; fix introduced failures and separately retain
   reproduced baseline problems. Commit/integration/publication and public/offline
   acceptance have not occurred for this implementation.

## Evidence: passes and limits

| Evidence retained | Result | What it does not establish |
| --- | --- | --- |
| Focused appearance/Studio/community checks | 111 passing tests | Whole-repository test pass. |
| Standard practice | 207 passing tests | All explicit World coverage by itself. |
| Explicit World/appearance | 62 passing tests | Every replay/course/theme combination. |
| Lint, content/localization validation, generated projections, build | Passed; local build 0.142.4, 2,748 files | Validation does not find all hardcoded untranslated text or prove visual quality. No publication occurred. |
| Packaged browser checks | All eight Apply actions, readable primary/selected states, Pause/Resume and a Porcelain Studio edit/export/native-preview journey passed | All themes × every screen/state. |
| Additional browser coverage | 11 support/tool routes; one 390px DOS + Plain/Large + high contrast + ornaments Off + reduced-effects case | Physical input, complete multilingual coverage or every accessibility combination. |
| SIM WebGL | 192 family/environment/quality configurations; repeated switching showed stable resource counts | Human flight readability or representative cross-device performance. |
| Local p95 cadence | Approximately 16.7–16.8ms on one 60Hz setup | GPU headroom or the release regression budget on other devices. |
| Academy package | 62/64 files; 4,054,847 bytes / 8 MiB | Unlimited room for new assets; only two file slots remain. |
| World package | 93/96 files; 14,497,803 bytes / 16 MiB | Bulk asset headroom; three file slots and about 2.17 MiB remain. |
| Exploratory full suite | Stopped after repeated failures; some reproduced on baseline HEAD, others not fully classified | Neither a full-suite pass nor proof that every failure is pre-existing. |

The original missing-dependency and stale-assertion concerns should not simply be
carried forward as unchanged blockers: scoped setup/assertion corrections were
made. The current open item is the remaining unexplained broader failure set.

## Proposed order for review

These are recommendations, not a newly accepted queue. P0 means a release blocker;
P1 means the next product completion work; P2 follows the representative approval;
P3 remains deferred. Independent baseline investigation and art review can overlap.

| Rank | Priority / workstream | Why now | Concrete finish condition |
| --- | --- | --- | --- |
| 1 | **P0: trustworthy release baseline** | Prevents broad working-tree changes from being mistaken for a ready release. | Relevant gates reproducibly pass; every remaining wider failure is fixed or individually classified with retained baseline evidence. |
| 2 | **P1: Industrial complete-journey polish** | Directly addresses the user's unreadable labels, mismatched panels and native-game quality concerns. | Named screen/state inventory reviewed; representative UI, Arcade, SIM and Studio experience approved; no unexplained consistency omissions. |
| 3 | **P1: custom community theme workflow** | Closes the clearest missing requested feature rather than adding more selectable skins. | Edited immutable theme registered through the curated path and reused across two community/campaign contexts, offline and with personal overrides. |
| 4 | **P1: localization, input and device qualification** | Makes the polished result usable and supplies currently missing release evidence. | Company Studio strings localized; full EN/UK journeys; physical touch/controller and target-GPU routes; readability/motion checks; measured performance/resource comparison. |
| 5 | **P2: production art depth and reusable asset pipeline** | Converts proven material coverage into reviewed production quality without multiplying unapproved assets. | Small representative asset set passes export/validation/viewer/runtime checks; approved improvements applied to Industrial, then Vyshyvanka/Dnipro. Plan within current package caps. |
| 6 | **P2: qualify the remaining families** | Preserves the eight-theme investment while prioritizing depth. | Tryzub, Desktop 98, DOS, Orchard and Neon meet the same contrast, interaction, art and journey standards. Replace remaining family-specific assumptions as creator-defined collections expand. |

Before a new SIM collection revision is published, retain older exact revisions or
define their availability/distribution lifecycle. Current fallback behavior is
implemented, but it is not a substitute for retaining assets promised to recordings.

## Choices for rebalancing

- **A — Quality first (recommended):** keep the eight implemented families, stop
  adding more, polish Industrial end to end, close the custom-community workflow,
  then concentrate art work on Vyshyvanka and Dnipro. Baseline and device checks run
  alongside this work. Other families remain available but are not described as
  fully art-approved releases until reviewed.
- **B — Community creators first:** move custom-theme registration, distribution
  and a real community pilot ahead of deeper texture/model production. Keep the
  existing materials for the first pilot; retain readability/release gates.
- **C — Art first:** prioritize the representative source-to-runtime asset set
  and distinctive Industrial/Ukrainian textures, icons, sprites and SIM finishes.
  Custom publishing and release happen later; technical coverage alone does not
  close the art work.

One default behavior also deserves explicit review: the original plan described
Industrial as opt-in, while the current implementation uses it as the fallback for
new profiles that follow campaign/community appearance. Existing preferences are
preserved. Confirm that current new-profile behavior in the rebalanced plan, or
restore an opt-in default; this is a product choice, not an unresolved engine issue.

Continue deferring new sounds, texture streaming, arbitrary player theme-file
installation, and detailed realism unless reprioritized. Remaining parallel
generated GLB assemblies, articulated actors and later World content are separate
integration work, not completed assets hidden inside this theme release. Existing
whole-product campaign/roster/content commitments are unchanged by this report.

## Source and evidence links

- [Implementation description](industrial-workshop-implementation.md)
- [Final local verification and explicit limitations](verification/appearance-system-2026-10-02/final/README.md)
- [Appearance evidence index](verification/appearance-system-2026-10-02/README.md)
- [SIM source kit and production boundaries](../authoring/fpv-worlds/industrial-workshop.md)
- [SIM render/performance evidence](verification/eight-theme-sim-2026-10-02.json)
- [Theme contracts and installed collections](../game/presentation/theme-system.mjs)
- [Studio candidate/default handoff](../authoring/asset-studio/studio.mjs)
- [Community default model](../authoring/company-studio/model.mjs)
- [Company Studio appearance controls](../authoring/company-studio/studio.mjs)
- [Runtime export contract](../game/presentation/runtime-transfer.mjs)
