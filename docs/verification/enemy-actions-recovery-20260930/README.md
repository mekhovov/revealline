# Preserved authoring proposals: current-source recovery

Base: `908bc6b08d1999edafa79d1581d2bab9395285b7`, 30 September 2026.
Final source rebase: `5c12b4028` (PR849), with no conflicts or overlap in
this batch's seven paths. Browser and localization evidence above were gathered
on the original base; required hosted admission qualifies the submitted head.
Source intake: [issue824](https://github.com/mekhovov/revealline/issues/824).

## Adopted current behavior

Enemy workshop now groups its five existing actions in a wrapping layout with
16px gaps, 44px minimum targets and long-label wrapping. All existing IDs,
localization attributes, Workshop/game return ownership, DOM order and link
paths remain unchanged. The old three-action HTML is not replayed. No simulation,
saved data, artwork or catalog input-owner change is included.

Still Media recovers the historical 49-line regression enhancement against the
newer host: Close before first Open, immediate/settled focus restoration, and
exact saved document/revision/generation/blob preservation after closing storage.
Newer soundtrack and lifecycle assertions remain unchanged. No new runtime data
behavior is claimed from unexecuted assertions.

## Browser evidence

Local source preview: `http://127.0.0.1:8817/authoring/enemy-catalog/`.
The original 320px Ukrainian page placed Return to game directly beside Feedback
comparison with no group gap. Source review confirmed no shared wrapping owner.

After the correction:

- Ukrainian 320×568, 390×844 and 844×390 CSS viewports: all five actions measured
  exactly 44px high; document width matched viewport width; group gap 16px.
- Startup Role → Tab to Presentation → Escape returned to `open-catalog`.
  Four further Tab presses reached Feedback comparison in the preserved order.
- Reflow from portrait to short landscape retained that focused action.
- English 844×390 retained all five 44px actions. English 390×844 startup/close
  returned focus to Open; [portrait screenshot](portrait-390.jpg) records the
  painted focus clearance and full action group.

This is native desktop-browser interaction and CSS-viewport emulation. No
physical touch/controller, modeled controller suite, Large/Plain/200% zoom,
full gameplay, offline or deployed-byte acceptance is claimed. The dynamic
ready-status sentence retains its prior language until reload after a live
language change; that existing behavior is outside this layout correction.

## Source checks

Scoped Prettier 3.6.2, ESLint, JavaScript syntax and whitespace checks pass.
The full localization validator passes: EN/UK, 11,992 messages and 8,858
references. Independent source review found no code issues; its clarification
about enabled return actions is incorporated in the guide. Automated
regression execution is `WAIVED_SKIPPED_NOT_PASSED` under the committed
[temporary policy](../../focused-test-waiver-20260930.md). Required source identity, build/capacity and publisher admission remain separate gates.

## Historical Team retention: unresolved, not superseded

The preserved source at `../local-worktree-intake-2026-09-30/pending-team-retention/`
contains old fpv38/50 owned-presentation adapters. Current `coop-picture-bindings`
admits 58–97, 99–104. Current imported presentation validation requires the
receipt's theme revision to equal the prepared snapshot and the approved current
policy. Neither fact demonstrates restoration of an fpv50 envelope.

Historical v0.78.0 tag `e9434d03feb30bf8767051b2832a4ab987b2fa41` contains a real
presentation-envelope import path and fpv50 binding. Current retained-runtime
compilation preserves 54, 58, 60, 62 and distinct 101–103 production identities; the
old 38/50 wrappers have no proven equivalent. Keep issue824's Team item open.

Next action: intake one exact historically supported envelope and its required
originals, establish the supported-version contract, then adapt current import
resolution or expose an explicit unsupported/recovery path. Do not replay old
renderers, fpv51 production outputs, stale versions or private media to remove a
local diff. Source preservation is distinct from runtime compatibility and from
production-art approval.
