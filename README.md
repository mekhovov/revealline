# RevealLine local recovery — 29 September 2026

This branch preserves local source history and working/index snapshots. It is a recovery archive, not a product release candidate. **Do not merge it into main or use it as a release source.**

`branch-preservation.json` records the original local branch identities and historical frontier tips. Each frontier tip is reachable through this branch’s parent history. `worktree-snapshots.json` records the exact recovery commit for each nondependency dirty checkout. Those commits contain `working-tree/` files, separate `index-stage-0/` through `index-stage-3/` blobs, and a `snapshot.json` describing the original base and missing paths. Original worktree files, branches and staging areas were not reset or changed by capture.

The interval capture includes old generated files, superseded proposals, partial checkouts and unresolved conflict stages. Their presence preserves evidence; it does not approve their behavior or missing-file deletions. Current feature PRs control release integration. Dependency links, OS metadata and ignored build caches are outside this source snapshot.

Independent verification checked the original parents, every recorded tree mapping, all captured working-file hashes, and all index objects. Physical device and product acceptance are separate from this recovery check.
