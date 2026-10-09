# Ornament port recovery — 9 October 2026

This directory preserves the exact unresolved merge found in
`/private/tmp/revealline-ornament-port-20261009b`.

The source worktree was detached at `1b3f362b2c3d479a8da7f500750b58cba3e5ab25`
and contained a 40-path attempt to combine an older spatial-challenge candidate
with later ornament-route work. The source index has 77 conflict-stage entries.

## Preserved material

- `worktree-status.txt` and the two name-status files record the source state.
- `working-tree.patch` and `index.patch` retain the non-conflict deltas.
- `unmerged-index.tsv` and `conflict-stages/` retain every base, ours and theirs
  blob needed to reconstruct the unresolved paths.
- `worktree-state.json` records the source head and operation markers.

## Disposition

This is an archival recovery record, not a production integration. Current
`main` contains later mission, route-loader and ornament implementations.
Applying this old merge mechanically would overwrite current identities and
contracts. A future product change must start from current `main`, select one
specific behavior from this evidence, and add current tests before it can be
merged.
