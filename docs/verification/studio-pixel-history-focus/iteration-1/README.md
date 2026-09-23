# Studio pixel history focus proposal

Base: `20370a67892e5d48d65b0be9277c715d297b9f47` (PR247 stack).
Proposal only. No branch, PR, version or release changes.

The native defect reported by root occurs when the focused Undo or Redo button
becomes disabled at its history endpoint. The proposal enables and focuses the
opposite available history action before disabling the owned endpoint. If a
fresh document has neither history action, canvas receives focus. Non-endpoint
Undo, canvas keyboard shortcuts and unrelated/newer focus retain their owners.

## Files to integrate

- `candidate/authoring/asset-studio/sprite-panel.mjs`
- `candidate/game/test/sprite-panel-focus.test.mjs`
- `proposal.patch` contains only those two paths, with repository-relative names.

The other candidate/baseline files are exact small dependency copies from the
base commit and must not be included as changes.

## Independent qualification

Same final test bytes on Node 20.19.5 and 22.22.2:

- Exact baseline: 11 passed, 4 failed. Failures are Undo endpoint, Redo endpoint,
  empty-history canvas fallback and successor focus callback.
- Candidate: 15 passed, zero failures/cancellations/skips.
- Nine panel cases and six unchanged sprite editor cases.
- Exact pixels, history dirtiness, intermediate Undo ownership, Ctrl/Cmd+Z and
  Shift+Z, unrelated focus, focus during painting, and successor focus callbacks.
- Both changed files pass scoped no-undef/no-unreachable rules and Prettier.
  Authoring browser globals were applied explicitly because repository default
  ESLint file patterns do not include authoring modules.

All four complete TAP logs and hashes are in `evidence.json`; static checks are
in `static-checks.json`. Dependency bytes are pinned there as well.

The fixture models native focus loss when disabling a focused control. It does
not prove native layout, browser focus rendering, physical input, full Studio
workflow, source release gates or public deployment. Root's independently
observed native failure and its follow-up browser check remain separate evidence.

Run from either baseline or candidate:

```text
/path/to/node --test game/test/sprite-panel-focus.test.mjs game/test/sprite-editor.test.mjs
```

Maintainer/prompt lesson for integration: keep sprite history availability driven
by the real editor; transfer focus before disabling an owned endpoint. Do not
move focus for canvas shortcuts, background redraws, or newer unrelated focus.
Test pixel/history invariants alongside focus, and record actual browser evidence
separately from the modeled DOM boundary.
