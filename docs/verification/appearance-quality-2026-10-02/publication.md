# Appearance PR publication and next work

The implementation is published on `codex/unified-appearance-20261002` against
`main`. It includes the complete appearance changes rather than depending on the
already merged personal-best ghost PR #913. Baseline route/harness repairs are a
separate commit. The integration preserves main at `fc0eaf978`, including the new
SIM entry/practice directory, mobile and pause geometry, flight lifecycle, radio
and replay behavior, menu capture routes, garage demonstrations and hangar surfaces.

## Testable preview

The **Appearance preview** PR check runs an explicit focused cohort and builds
the exact PR head. A successful run attaches a full game ZIP and separate Worlds
playtest ZIP, source/tree identity, builder receipts, test output and SHA-256
checksums. These are development previews, not a production deployment. Follow
[the testing guide](../../../appearance-preview-testing.md).

New preview artifacts supersede earlier ones when the PR head changes. Earlier
screenshots, package sizes and local build hashes in this directory remain
historical receipts; they are not acceptance evidence for a later PR build.

## Integrated verification

The source is integrated with main at `fc0eaf978`. The initial local verification
below predates the final capacity repair and main merge; the exact source identities
are recorded in each receipt. Local checks use Node 20.19.5;
the PR preview pins Node 22.13.1 and records its exact head and source tree.

- Exact 28-file PR preview cohort: **235 passed**, no skips or failures
  ([receipt](publication/appearance-preview.json), [TAP](publication/appearance-preview.tap)).
- Standard practice: **224 passed**, no skips or failures ([TAP](main-integration/practice.tap)).
- Explicit World/appearance: **62 passed**; Academy UI/replay/setup: **41 passed**
  ([SIM review](main-integration/sim-review.md)).
- Navigation/menu integration: **56 passed** ([TAP](publication/navigation.tap)).
- Latest main demo integration: **59 passed** ([TAP](publication/demo.tap)).
- Sparse publisher boot: **2 passed**, with isolated actual workflow dependencies
  ([TAP](publication/sparse-publishers.tap)).
- Whole-repository ESLint, content/localization validation, presentation metadata validation,
  generated theme bootstrap and byte-identical embedded SIM assets passed.

These suites overlap and should not be added into a unique-test total. Earlier
full-suite failure classifications are retained as historical evidence; no
full-suite pass is claimed. Current-main package limits remain unchanged at
Academy 72 files / 8 MiB and World 104 files / 16 MiB, including source archives. Before the final hangar merge, admitted Academy uses 67 runtime / 69 source
files (4,095,466 / 4,123,721 bytes); World uses 99 / 101 files
(14,106,740 / 14,139,819 bytes).
[Package closure receipt](publication/package-bounds.json).

## Community capacity follow-up

The first PR build produced the full game and Worlds preview successfully. The
separate 18-community candidate build found one oversized edition:
`droneaid-nl-community`, at 67,409,811 bytes against its unchanged 64 MiB limit.

The compiler now removes indentation only outside runtime engine JavaScript
tokens and comments, using the existing Acorn parser. It preserves raw literals,
template text, regular expressions, comments and every line terminator. Vendor
code and authored campaign/media inputs stay byte-identical. Projection occurs
before offline inventories and final hashes, with original/output provenance.

The initial repaired edition is 66,665,104 bytes (830 files), saving 744,707 bytes
and leaving 443,760 bytes of headroom. Two builds reproduce exactly; ZIP admission,
77 media originals and current/four retained presentation identities pass. The
runtime suite passes 15 tests and compiler/admission/localization/raster checks
pass 40; independent adversarial lexical review found no blocking issue.
[Capacity receipt](publication/edition-capacity-fix.json),
[runtime checks](publication/edition-runtime-indent.tap),
[compiler checks](publication/edition-capacity-tests.tap).

After the menu/garage main merge, clean source `ee855c377` produces **66,673,106 bytes**
across 830 files, with **435,758 bytes remaining**. Archive admission, current/four
retained presentation identities and all 77 selected media originals pass again.
Runtime checks pass **15/15**, and the integrated menu suite passes **39/39**.
[Final capacity receipt](publication/edition-capacity-final.json),
[final runtime checks](publication/edition-runtime-indent-final.tap),
[final menu checks](publication/menu-scenes-final.tap).

The expanded 30-file preview cohort passed **279/279** in CI on `7b049aec6`,
with successful game/Worlds archives, community candidate admission, default
capacity and optional-package checks. That artifact predates the final narrow
hangar integration; later artifacts record their actual test list and head.

Main subsequently merged the hangar surface refinement. Its concrete slab scale,
painted-steel panel projection and rubber service strips are preserved alongside
the shared theme roles and bounded texture sampling. Authored appearance uses
main’s surface recipe; explicitly selected collections retain their own material
recipes. Runtime geometry and flight data remain outside this presentation change.

The final hangar integration passes **36/36** focused visual/appearance checks.
Authored rendering inputs match main exactly at all three quality presets; an
independent review checks all eight collections and three presets for theme
bindings, bounded sampling and one-time resource disposal. Academy now uses
67/69 runtime/source files (4,098,781 / 4,127,036 bytes); World uses 99/101
(14,360,707 / 14,393,786 bytes), within the unchanged caps. No new browser or
physical-GPU acceptance is claimed.
[Focused checks](publication/hangar-merge-tests.tap),
[surface parity](publication/hangar-merge-surfaces.json),
[package admission](publication/hangar-package-bounds.json).

## Scope delivered

- One coordinated Appearance control, accessible semantic foreground/background
  pairs, common material/state recipes and generated first-paint support.
- Eight selectable families, including Industrial, Ukrainian embroidery and
  porcelain styles, Desktop 98 and DOS, with preserved legacy preferences.
- Studio workspaces, runtime previews and curated custom interface candidates
  reusable across community/campaign contexts. Exact installed Arcade/SIM art
  dependencies remain required; arbitrary custom asset publication is outside
  the current implementation.
- Shared SIM appearance bindings, recording pins, first-arm world/model freeze,
  recovery diagnostics, bounded cross-tab custom-theme handoff and sampling rules.
- Main's new SIM/practice navigation retains its launch intent, language, return
  route and lifecycle while transferring appearance on activation.

## Remaining plan, in priority order

1. **Industrial screen and input acceptance.** Review the named home, mission,
   pause, results/rewards, settings, dialog/error and Studio journeys, including
   English/Ukrainian, narrow layouts, Plain/Large text, high contrast, ornaments
   Off, keyboard and actual touch/controller/screen-reader use. This closes the
   original readability and consistency request. Locked routes still need the
   ordinary credential; no access gate is bypassed by the preview.
2. **SIM flight readability and performance.** Record fixed routes at near/far
   distance and grazing angles on target GPUs at every quality preset. Check
   orientation, gates, landing marks, shimmer and the <=10% p95 frame-time budget.
   Functional tests and one-device render matrices do not establish this gate.
3. **Representative production asset pipeline.** Approve a small drone, gate,
   pad, vehicle, ground and wall set through export, glTF validation, an independent
   conformant viewer and actual flight. Current procedural role coverage is not
   a claim of final bespoke production art.
4. **Industrial art depth, then Vyshyvanka/Dnipro.** Apply the approved pipeline
   to assets that benefit from distinct authored materials/meshes/sprites, within
   package budgets and with retained exact revisions for recordings.
5. **Qualify the other installed families.** Desktop 98, DOS, Tryzub, Orchard and
   Neon need their own art and complete journey acceptance. Additional families,
   realism, sounds, streaming and arbitrary player theme installation remain later.

The earlier interrupted full-suite failure classification is retained separately.
A green focused preview does not mean the full repository suite is green. Release
readiness also requires fresh offline installation, the complete community export
journey, device qualification and disposition of outstanding baseline defects.
