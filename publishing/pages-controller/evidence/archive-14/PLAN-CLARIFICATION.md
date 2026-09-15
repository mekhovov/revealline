# Addendum: Archive 14 publication plan and review

This additive clarification supersedes only the two wording errors below in `PLAN.md` and `evidence/local-review.json`. It does not replace or modify their pinned bytes, the independent review, the preparation manifest, or any of the 16 candidate files.

1. **Triggers:** the accepted template retains `workflow_dispatch` as a manual retry path. Both build and deploy jobs require `refs/heads/main`, and concurrency remains serialized with cancellation disabled. The intended initial publication is one push to main. A manual retry is available if needed after an actual failed attempt; do not dispatch a duplicate alongside the automatic run or describe the workflow as lacking a manual trigger. No dispatch has been performed.
2. **Build marker:** the unchanged extractor's `.xonix-build.json` marker is **53 bytes**, not 51. Its SHA-256 is `d11b193572cbfd5bb927650a35bd1a5387a376160f1177b522ab69f5799177fa`. The existing expected inventory already contains the correct 53-byte row, so its 662 files / 312,553,884 bytes and hash do not change.

All 16 candidate pins were independently reread again and match both prior reviews. The complete 28-file preparation manifest also remains unchanged. Four ignored local Python bytecode files are outside the candidate source inventory; any future staging must use the 16 explicit source paths or the existing `.gitignore` exclusions.

The independent review reports no blockers. Repository creation, infrastructure commit/push, workflow execution, Pages deployment and main-controller admission remain unperformed and await the root's separate scoped publication step. This addendum is documentation only; it does not accept the archive, v0.57.0 or P01.
