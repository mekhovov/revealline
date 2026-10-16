# Company Studio cached-page lifecycle recovery

Source basis: 1e0fa85b048ce7ebbf8732632e001b83e5a90ac4.
Inventory context: local commit 9c658d61d3b44196d9fcbe7fe80110cc451bea6a.
Its operation/import/export changes already survive in main. This is a
current-compatible repair of two lifecycle gaps found during that reconciliation,
not a replay of the historical snapshot or a claim that every lifecycle gap is closed.

## Narrow correction

- On cached-page departure, retire the lesson workbench viewer but retain the
  guided field nodes, unstaged values and preview attempt. Return does not sync,
  stage, export or automatically restart the viewer. Explicit Resume rebuilds it.
- On terminal departure, retain the existing permanent lesson disposal behavior.
- Retire whole-game preview verification ownership before aborting its request.
  Late success and late rejection cannot update status, the frame or the report
  after departure. A current owner's real failure still reaches normal handling.

No Discovery or reward editor lifecycle API is changed. Their compatible
lifecycle recovery remains separate work. No saved progress, catalog, schema,
audio recipe, production ledger, compiled assets, CI policy or budgets change.

## Verification

Source and caller closures were reviewed. JavaScript syntax parsing and
formatting completed. Six regression cases were added: one actual-host cached
return case, four actual-host late-response cases (cached/terminal, success/
failure), and one lesson suspension/explicit-Resume/terminal-disposal case.

These new cases have NOT been executed. Full suites remain
WAIVED_SKIPPED_NOT_PASSED. First exact-source execution belongs to deferred test
follow-up #813. Historical donor receipts do not qualify these adapted fixtures.
No local product tests, build, producer or compiler was run.

The two authoring modules are included in the main distribution and add a small
amount of source text; hosted default-capacity and Pages build gates still apply.
The test files are excluded by the distribution collector, and this document is
outside its explicit includes. Optional Company packaging is separate from the
mandatory main Pages capacity gate. No publication budget is raised.

## Scope limits

This does not demonstrate a real-browser BFCache journey, packaged-player
acceptance, physical device behavior or current generated-provenance approval.
It does not complete the broader PR/branch/worktree/dirt/stash/reflog inventory.
