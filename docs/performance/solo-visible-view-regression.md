# Visible-view fixture and optional workflow corrections

The five Company CI failures at `2ec605eb76e38f9c9a3e21b7fa82dd80c580c457` were corrected in test fixtures. Runtime behavior and expected progression remain unchanged. The four complete affected files now pass **58/58** local Node cases; the three complete workflow/policy files pass **32/32**. This is scoped local evidence, not a whole-PR CI or performance pass. Exact file hashes, original failures, test logs and receipts are in [the evidence record](solo-visible-view-regression.json).

## Original failures and retained assertions

Company run `38963866024`, job `117185378265`, reported 1,363 cases: 1,358 passed and five failed. These failures are not baseline-waived.

- The selector case read dormant Legacy mission cards after a win. It now checks the stored clear immediately, then admits the actual retained dialog/picker after public Pause. Its mission identity, unlock, medal, geometry, locale, difficulty and checkpoint assertions remain. This does not claim unified Missions coverage.
- The controller-practice case and two Showcase cases queried a closed Collection shelf. The corrected cases open the real public Collection control and await its existing readiness. Showcase still checks the exact accepted reward on the visible result surface before waiting for durability; its original shelf assertions remain after opening Collection.
- The Studio preview case failed before Retry while waiting for the closed shelf. It now checks the immediate result, opens and closes Collection publicly, then runs the original Retry, database-isolation, lock and storage assertions.

The first local attempt is retained as **54/58 passed, four failed**. All four failures reached Collection readiness: the finite DOM has no `MutationObserver`, and `settle()` supplies only `frame(0)`. Collection's pause refresh happens before the dialog opens; the existing host fallback refreshes the interface after 100 ms. Each corrected opening therefore asserts that the actual dialog is open and advances one paused 100 ms host frame before the unchanged bounded readiness check. The authoritative checkpoint must remain unchanged. No timeout, expected outcome, simulation policy or runtime was changed.

The earlier extracted count of 53 omitted five existing parameterized Edition cases. The complete-file footer establishes the actual 58-case count; both the earlier inventory and its correction are retained.

| Complete file                                       | Final local result |
| --------------------------------------------------- | -----------------: |
| `game/test/company-selector-identity-host.test.mjs` |                1/1 |
| `game/test/edition-solo-host.test.mjs`              |              51/51 |
| `game/test/showcase-studio-playthrough.test.mjs`    |                2/2 |
| `game/test/studio-preview-session.test.mjs`         |                4/4 |

All completed naturally with no skipped/cancelled cases or owned survivors. The runner used Node 22.22.2, serial files, a 600-second per-file bound, 4 GiB process-group memory bound and 16 MiB TAP bound. Relevant source/test hashes stayed stable during execution.

## Optional workflow source coherence

The failed optional job first passed 334 practice tests, then invoked `practice:pointer:test`, which does not exist at the checked-out PR head. The original baseline and PR head have the same package/workflow bytes; newer main introduced real pointer/observer suites in the merged workflow. This was a merged-workflow/exact-head-checkout mismatch, not removal of those suites by this PR.

Only the optional job now checks out `github.sha`, verifies the actual checkout, and records both the tested event revision and PR head. Its artifact name identifies merge integration separately. The Company candidate job and exact-head release gate remain unchanged. No empty script alias, optional missing-script skip, new main-only command or deadline increase was added.

Complete local policy results are `publishing/source-workflow.test.mjs` **7/7**, `publishing/fastline-merge-controller.test.mjs` **18/18**, and `scripts/test-bundle-editions.mjs` **7/7**. Scoped ESLint, Prettier and diff checks passed. The original hosted failures remain recorded until a new hosted run actually establishes its result; neither these local checks nor the independently verified package establishes that all CI or the broader qualification plan passes.
