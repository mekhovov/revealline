# Serial packaging qualification (prepared; no candidate build started)

Run only after the reviewed packaging fixes and their tests are committed, while that exact HEAD is held. The source checkout must be clean. This helper creates no worktree, installs nothing, fetches nothing, and calls no publisher.

```sh
python3 .cache/qualify-packaging-serial.py \
  --run approved \
  --head EXACT_COMMITTED_HEAD \
  --node /Users/oleksandr.mekhovov/.local/share/mise/installs/node/22.22.2/bin/node \
  --out /ABSOLUTE/EXISTING/EXTERNAL/PARENT/NEW_UNIQUE_CANDIDATE_DIRECTORY \
  --report /Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/shared-game-demos/.cache/NEW_UNIQUE_PACKAGING_RECEIPT.json
```

The output parent must already exist on a different filesystem from the checkout, using its real absolute path. The parent/output device and inode are checked while each child runs, and the owned output directory is held open. Bulky artifacts, bounded logs, and each child's temporary directory stay there. The small final receipt stays in ignored local scratch so a failed mount does not destroy the result. Outputs are never overwritten or deleted. A failing CLI's original log, candidate output, and temporary artifacts remain for review.

The helper derives all 18 current public edition IDs from `game/editions/catalog.json` and all three optional IDs from `OPTIONAL_PACKAGE_POLICIES`. If scope or the established limits change, it refuses to run until reviewed. It launches **21 distinct children, strictly serially**, to release memory between candidates:

```sh
node scripts/bundle-editions.mjs --editions ONE_ID --out ABS_NEW_DIRECTORY --base-path /revealline/
node scripts/bundle-optional-practice.mjs --packages ONE_ID --out ABS_NEW_DIRECTORY --base-path /revealline/
```

Every canonical child independently verifies clean committed inputs, builds twice, compares reproducibility, and admits both original runtime and source ZIP members in memory and after writing. Company additionally checks public source eligibility and provider parity. The supervisor validates exact source/envelope/result pins and retains authenticated artifact descriptors, complete source archive counts, and process cleanup evidence. It stops at the first failure and records every uncompleted ID. It does not claim a combined release-envelope check or any promotion, device, browser, or human acceptance.

Default bounds: 300 seconds per child, 3600 seconds for the Company group, 900 seconds for the optional group, 1 MiB per child log. Execution deadlines are polled while children run, and group deadlines are checked after final validation. Synchronous filesystem/system calls can delay those checks; this is not a hard end-to-end I/O deadline. Signal handlers defer cancellation through successful spawn and ownership registration without blocking signals in the child. The existing reviewed identity-aware process owner supplies bounded cleanup; only observed exact child/descendant identities may be signalled. Node/platform are recorded explicitly; local macOS Node 22.22.2 does not substitute for hosted Linux Node 22.13.1.

Before the clean commit and batch, run the focused proposed packaging regressions and existing affected admission/build tests (serial file concurrency limits memory):

```sh
node --test --test-concurrency=1 game/test/edition-demo-packaging.test.mjs publishing/edition-admission.test.mjs scripts/test-bundle-editions.mjs publishing/optional-package-admission.test.mjs scripts/test-bundle-optional-practice.mjs scripts/test-optional-practice.mjs
```

The separate existing `npm run company:check` verifies generated Company content and public source eligibility. The canonical Company bundler repeats the eligibility portion itself. No new generator is introduced by either packaging patch. Formatter/linter checks should cover only the changed files, retaining all existing package caps and the optional no-network/module-closure restrictions.
