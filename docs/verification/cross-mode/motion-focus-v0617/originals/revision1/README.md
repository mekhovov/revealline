# Motion Lab focus after rotation — candidate

The focused rotor control now requests nearest scrolling when a viewport change leaves it clipped by the viewport or the independent settings panel. It keeps the existing focus, edited values, artwork, preview state and storage. If its label/value group cannot fit, the control itself is revealed.

The retained v0.60.9 native observation showed portrait-to-short-landscape rotation leaving the focused slider offscreen until another Tab. The Motion display lifecycle had no resize visibility action; the canvas resize path only repainted the arena. The correction lives in that existing page-owned lifecycle and rejects hidden, disabled, inert, background, departed and stale focused controls. Visible fields do not request another scroll. No new focus assignment, navigation, deferred task or preview start is introduced.

## Scope and source

- Worktree: `.cache/worktrees/p03-motion-focus-rotation`, branch `codex/p03-motion-focus-rotation`.
- Exact parent: `4fd8e2dac4fdc851d0d2bf0b21e77162d9d405c9`, tree `d16edac0127fc96139445ae2365cc74499f80921`.
- Four paths: display owner, actual-host regression, Motion guide and runtime-maintainer skill. The manifest includes exact base preimages, new bytes and hunk locations. The formatter also removed one adjacent pre-existing duplicate blank line in the guide.
- Version remains 0.61.6; nothing staged, committed, pushed, released or browser-tested. Qualified worktrees and root source were not edited.

## Evidence

The first actual-host regression failed against the original source because no scrolling occurred. Both complete Motion display-host and restoration files then passed: **56/56 on Node 20.19.5 and 56/56 on Node 22.22.2**, with no failures or skips. Cases include paused-state preservation, settings-only clipping, already-visible repeat, lifecycle/disabled guards, changed focus and an oversized label group. Explicit rectangles model geometry; these tests do not reproduce a browser layout engine.

Scoped lint, Prettier check and Git diff/index checks passed. Formatting followed the full test runs; exact AST comparison confirms both JavaScript files remained semantically identical. Existing unrelated source tests were not rerun. Read-only producer tracing found none of the four paths among the 17 production recipe source entries; display.mjs is already a runtime build include. No generated assets changed.

Peer `/root/team_final_gate` independently reviewed the source and tests and found no blocking issue. Its review is retained separately and does not claim independent test or native execution.

## Remaining acceptance

Root review, version allocation, complete source gates/build, exact-source qualification, real browser portrait/landscape and Large/Plain checks, PR/release and deployed verification remain. Physical rotation, touch/controller and visual-viewport behavior remain separate. This correction advances P03; it does not close the complete navigation phase or alter the approved phase order.

`ready.json` pins the source patch, manifest, original observation and checks. All historical RED/GREEN receipts remain intact.
