# Active gate cue review — 2026-10-02

Scope: a shared runtime objective cue correction following the observed faint distant Dnipro gate frame. This does not change pinned collection documents, models, material maps, course content, or recordings. Existing authored/noncollection profiles keep the original frame and badge path. Compatible collection profiles, including previously pinned collections, receive the corrected runtime cue.

The original 45 mm gate rails remain unchanged. Only the active gate gains four static corner brackets with adjacent dark and light neutral strips. Each strip is 60 mm wide; the pair extends at most 120 mm beyond the original frame's outside edge. Along the original edge, each arm covers at most 320 mm, further bounded to one quarter of the gate's span/height. The brackets retain the frame's 45 mm depth and lie entirely outside its outer edges, so they cannot narrow the physical aperture. There is no screen-space expansion or distant always-visible overlay.

Materials are unlit and tone-mapping independent, with depth testing and fog enabled, depth writing disabled, no shadow casting, and no render-order override. This maintains world occlusion and atmosphere. The original theme-colored outline and inactive/completed opacity hierarchy remain unchanged. The brackets add no animation. All gates share one cube geometry and two paints; each visible gate adds two instanced draws (192 triangles). The renderer's shadow ownership bookkeeping also remains reachable and releases with the goal group.

## Automated evidence

- `sim-gate-cue-focused.tap`: 59/59 tests pass, covering objective labels/cues, workshop visual ownership, World runtime, appearance/replay, World appearance UI, and acceptance workflow.
- Cue geometry tests cover both gate axes, very small and large openings, all eight compatible collections, strict exterior bounds, shared resources, and an adjacent paint contrast ratio above 15:1 before fog/blending. This is not a claim about every scene pixel's contrast.
- The actual renderer source runs against real Three.js scene/math objects with a mock WebGL renderer across authored plus eight collections and all three quality presets. It verifies unchanged frame dimensions/positions, active-only cue visibility, original inactive opacity, unchanged course data, and exactly-once disposal of instanced meshes, shared geometry, paints, and shadow owners after switching to authored.
- Focused ESLint and `git diff --check` pass.
- Independent read-only review found no blocker in exterior placement, shared ownership, or active-only visibility. It correctly reserves actual distant readability and transparent-surface occlusion for browser review.

The Node checks do not render pixels or measure GPU frame time. Browser comparison, depth-occlusion inspection, and paired performance evidence must be reported separately before claiming a visual or performance pass. Full environment/quality/device acceptance remains open.

## Source snapshots

- Before: `dist/sim-appearance-acceptance-gate-cue-before-5fbceaae5/authoring/fpv-worlds/acceptance.html`; manifest SHA-256 `631deac24136c8271434e7775736bfcfe42bc20cbc98c41b2dc38dddebccc73e`; 35 files, 5,584,788 bytes; base revision `5fbceaae5c9544af69f570f3a29771b42362aba2` with working-tree snapshot metadata.
- After: `dist/sim-appearance-acceptance-gate-cue-candidate-1/authoring/fpv-worlds/acceptance.html`; manifest SHA-256 `b432063ee5d9107dc88b8e0e2b3f2655f14a209ae81b712ea1ddad29a91e2562`; 35 files, 5,587,606 bytes; same base revision plus working-tree edits. This captures the coordinated renderer/GLB source freeze. The manifest identifies the complete captured closure, not only the gate cue patch.
