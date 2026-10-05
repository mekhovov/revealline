# Field Kit adoption as an atomic review commit

`scripts/field-kit-adoption.mjs` provides a guarded path from an isolated production candidate to a **new local review branch**. It changes neither the running checkout nor published files. The production ledger and complete compiled generation become visible together in one Git commit. The existing PR, committed-source build, artistic review and public delivery gates remain authoritative.

This avoids the legacy writer's two-location interruption window: `--write` swaps `game/presentation/compiled/` and then separately replaces `authoring/library/fpv-field-kit/production.rltheme`. Portable filesystem renames cannot atomically replace these unrelated paths. The new tool does not claim live filesystem transactions or retrofit the legacy command. Do not use that legacy command to adopt this candidate migration.

## Prepare and inspect

Use the exact clean committed checkout that produced the candidate. The output parent must exist; choose a new destination outside the checkout or below its `.cache` directory.

```sh
node scripts/produce-field-kit-theme.mjs --candidate /absolute/review/candidate
node scripts/field-kit-adoption.mjs --prepare /absolute/review/candidate /absolute/review/adoption
node scripts/field-kit-adoption.mjs --check /absolute/review/adoption
```

Preparation reproduces the candidate rather than trusting its receipt. It verifies actual source bytes against Git, the exact predecessor ledger and complete compiler-owned inventory, immutable history, all old payloads and the original published runtime's retained hash path. The proposed Studio document must equal its ledger. Unlisted files, symbolic links, altered ownership, stale source, changed candidate bytes and missing retention fail before any ref is exposed.

The adoption directory contains the reproduced candidate, `adoption.json` and `commit.txt`. The receipt pins source commit/tree/aggregate, baseline bytes, candidate review hash, proposed tree, exact commit and the transaction's unique `codex/field-kit-adoption-…` ref. Author and committer identity come from the preparer's configured Git identity; the exact recorded identity and timestamps make recovery deterministic.

Preparation and checking use a private temporary index and may add unreachable blobs/trees to Git's object store. They never modify the normal index, working files, commits or refs. Interrupted preparation can leave unreachable objects; normal Git maintenance can reclaim them. No rollback of published files is needed because none were changed.

## Explicit adoption, recovery and rollback

After the separate review work is complete, these are deliberate operator actions:

```sh
node scripts/field-kit-adoption.mjs --adopt /absolute/review/adoption
node scripts/field-kit-adoption.mjs --recover /absolute/review/adoption
node scripts/field-kit-adoption.mjs --rollback /absolute/review/adoption
```

`--adopt` first reproduces the whole packet and requires reviewed declarations with nonblank evidence for every required slot. It creates the exact recorded commit, then atomically creates its new review ref with an absent-ref comparison. It never checks out a branch, moves an existing ref, updates a default, pushes, merges or publishes. The current technical candidate is **not ready and must be rejected**. Tooling does not add approvals, change evidence, or relax the candidate migration's source-only restrictions. A future approved production continuation is still required before this command can succeed.

`--recover` is the same guarded operation. An interruption before ref creation leaves only unreachable objects; retry creates the same ref. An interruption after creation returns `already-adopted`. A ref pointing anywhere else, including a symbolic alias, is refused and preserved.

`--rollback` reproduces the packet and deletes only its exact unchanged review ref. It refuses a branch checked out in any worktree or advanced to another commit. Repeating a completed rollback returns `already-absent`. It does not undo merges, reset user work, remove commits or replace files. Use the original pinned checkout and avoid concurrent branch/worktree administration during these operations. Changes to source or packet require a new transaction, not a force flag.

The original source commit retains every baseline byte. The proposed generation additionally retains existing hash-addressed assets and historical runtime files, including the precise old `runtime.json` under its hash name, so saved appearance promises survive adoption.

## Review and delivery boundary

Inspect the new branch in a separate worktree, run the required committed-source checks and submit its complete ledger/compiled change together. Artistic approval, physical devices, audio, offline behavior, and public release remain separate. A successful atomic Git update proves consistent source ownership; it does not prove a visual treatment is approved or that a deployment has happened.

Regression sources cover private-index isolation, exact complete inventory, interrupted/idempotent ref creation, moved and symbolic refs, checked-out rollback refusal, retained runtime/history and unready declarations. They are authored without running the waived automated suites. No adoption, recovery or rollback has been executed against the real production tree as part of adding this tool.
