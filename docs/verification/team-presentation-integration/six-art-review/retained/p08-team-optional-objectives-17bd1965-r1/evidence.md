# Imported Team objective corrections

Six-path patch on `.cache/p08-team-anchor-art-17bd1965-r1/candidate`: **c4789defa02f9a03c309b01cf3eaef730bf6e34a93bd8d40d8219b82ef75aa5e**. Product changes are limited to Team painting and anchor image layout; related tests, authoring guidance and maintainer instructions are included. Local harness files are excluded from the patch.

## Defects and corrections

1. A native imported map contained three strongholds, only two required. All three looked required. Core captions now keep the relay number and SHIELD/CAPTURE/SECURED state, and append OPTIONAL when the authored victory goal does not require that core. Coverage missions treat all cores as optional to victory. Threat activity is unchanged.
2. Legal adjacent edge anchors could clamp two minimum-size decorative images into the same box. Painter now plans all image bounds first and omits colliding decoration on both sides, including mixed image/recipe neighbors. It also protects actual core targets. Every authoritative anchor border and letter/check stays at its existing semantic target. No import geometry, capture rule, state, score or original image is changed.
3. Anchor test measurement now scales with the actual canvas font size instead of a constant per-character estimate.

## Qualification

- The optional-caption regression was first run against unchanged product code and failed with missing `1 SHIELD · OPTIONAL`; retained `regression-before-node22.tap`.
- Both affected test files pass 19/19 on Node22; independent peer reruns pass 19/19 on both Node20/22. Added cases cover optional/required subsets, coverage goals, shield/exposed/secured states, adjacent/separate anchors, mixed recipes and core targets at 238/390/1152 CSS widths. Painter state remains unchanged.
- Broader exact-source 31-file Team/import cohorts: **503/503 on Node20.19.5 and Node22.22.2**, zero skipped/cancelled. Full reports: qualification-node20.tap and qualification-node22.tap. No assertions or timeouts were weakened.
- Lint, formatting and isolated patch dry-run pass. `source-pins.json` binds the six before/after files.
- Peer evidence: `.cache/p08-team-import-peer-17bd1965-r1/FINDINGS.md`, with 24 font-aware cases producing identical Node20/22 outputs and final source hashes.

## Native inspection

Temporary source-pinned localhost18830 harness decoded and SHA-256 verified both original 24px PNGs, then used the actual level validator and Team painter. Inspected separate and adjacent border maps at 238 and 390 CSS board widths, including mixed image/recipe states and reduced effects. The optional caption is readable and the crowded pair falls back to distinct functional cues. Harness marks captured states as deliberately staged inspection; it is not a gameplay completion claim or runtime theme adoption.

Actual Team host: ordinary file-picker import of the same multi-core pack, Start, visible `1 SHIELD · OPTIONAL` beside required relays2/3, then Escape with explicit Resume focus. Existing compiled art and shared actors/terrain remain present. No console warnings/errors. Browser viewport was left unchanged (the app viewport changed externally between earlier and later observations); 238/390 refer to the actual canvas CSS widths, not physical-device certification. Only the temporary owned tab was closed; both owned servers stopped.

## Limits and release handoff

Generic label placement remains a soft avoidance policy. Peer observed an approximately0.2 CSS-pixel full-frame edge overlap at238; this falls in the transparent border of the produced radios. No blanket qualification of every arbitrary imported asset/layout is claimed. Native dense-map checks used an isolated render fixture, not a full playthrough. Modeled import winning routes are separate evidence. No physical controller/device, full source/build/freeze, public/offline or default radio-collection adoption acceptance is claimed here.

Root workspace/index, versions, commits, PRs, tags and public bytes were not changed. Release owner must integrate after the consolidated Team chain (and compose the maintainer append after the radio-production patch), bump the next version, run the six source gates and applicable build/release/browser checks, then freeze/deploy/verify. Whole P04/P08 and the wider programme remain unfinished.
