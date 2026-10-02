# Appearance PR publication and next work

The implementation is published on `codex/unified-appearance-20261002` against
`main`. It includes the complete appearance changes rather than depending on the
already merged personal-best ghost PR #913. Baseline route/harness repairs are a
separate commit. The integration preserves main at `d4b284819`, including the new
SIM entry/practice directory, mobile and pause geometry, flight lifecycle, radio
and replay behavior.

## Testable preview

The **Appearance preview** PR check runs an explicit focused cohort and builds
the exact PR head. A successful run attaches a full game ZIP and separate Worlds
playtest ZIP, source/tree identity, builder receipts, test output and SHA-256
checksums. These are development previews, not a production deployment. Follow
[the testing guide](../../../appearance-preview-testing.md).

New preview artifacts supersede earlier ones when the PR head changes. Earlier
screenshots, package sizes and local build hashes in this directory remain
historical receipts; they are not acceptance evidence for a later PR build.

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
