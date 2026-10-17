# Library first-use CI correction

The 92ff source's [Industrial local-UX job](https://github.com/mekhovov/revealline/actions/runs/39054541641/job/117459719344) retained 699 passes and one failure. The [Company candidate job](https://github.com/mekhovov/revealline/actions/runs/39054541964/job/117459720317) retained 1,360 passes and three failures. Both encountered the dynamic-route test calling a Library handler before the asynchronous first-use owner finished. Company also encountered two edition tests that expected Library handlers and example packs before opening Library.

The correction changes those two test files, with no runtime or timeout change. The dynamic-route test joins the real Library and Challenges actions before invoking the existing route handler. Edition tests use Home → Settings → Extras → Workshop → Library and wait for its existing preparation status. The selected edition still proves Featured Start succeeds while Library stays unconstructed and the default pack index is never requested. The default game proves the pack index remains unloaded before the first Library visit and loads exactly once afterward. Existing saved-route restoration and mutable-input rejection assertions remain intact.

Both complete corrected files pass all 16 tests. Scoped lint and formatting pass. This is modeled public-route evidence; it does not establish native actionability or change the original failed CI conclusions. The next push must run the full required hosted jobs again.

The Industrial archive is artifact `12109222264`, 35,155 bytes, SHA-256 `548d78ef5eba7ad65896623a8740f4bc7f3aa0ea59879bb1d98359ba39272c19`. All three members (181,174 expanded bytes) were bounded, CRC-read and independently hashed. The raw Company failed-step log and the corrected full-file TAP are retained under `.cache/solo-followup/92ff-required-checks/`; `library-first-use-receipt.json` binds both source files and the original/corrected outputs. No full game archive or native browser was downloaded locally.

# Further first-use coverage after the 34d95 push

The canceled `92ff7ef80` Appearance run retained 1,633 top-level passing cases and 13 failures before cancellation, with no final TAP summary. The failures use Library, Collection, Challenges or Saves immediately after requesting a newly deferred interface. The subsequent `34d95cb9f` Appearance run was deliberately stopped while these known assumptions were corrected. Its separate admission job succeeded; its partial production-gate output has 252 top-level passes and no failures before cancellation. Neither run produced a package.

The corrections join the existing public action's preparation or wait for its actual visible section. Collection waits for its earned card and preparation indicator. The pagehide backup model now bridges the global listener after first Library construction, when that listener is registered. No shared fixture constructs Library eagerly, and no application readiness state, storage authority, timeout or qualification gate is relaxed.

The complete files for modal navigation, external backup, Classic, touchscreen controls, difficulty, Field Kit surfaces, Flight Information details/backups, backup feedback, device controls, text size and Solo soundtrack context pass **173 cases across twelve distinct files**, executed in separate groups. The original failing controls and intermediate failures remain retained. Difficulty's authored two-map fixture also now binds its retained source artwork to those actual map IDs, and its result flow advances the real bounded picture presentation before using the visible action. Required no-award, checkpoint and save assertions remain.

Retained canceled-run evidence:

| Item                        | Identity                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| 92ff partial test artifact  | `12110191577`, 79,065 bytes, SHA-256 `50efb7aa451fc0c79382f62defe706fa28ba5670ce98e18aaa2a780de7229ac4` |
| 34d95 partial test artifact | `12110357272`, 12,998 bytes, SHA-256 `3d05863e2b91765a16208e9865f020ec8a47ccb3aa697dbfaa1f1dfb15c8dcad` |
| 34d95 admission artifact    | `12109684562`, 6,332 bytes, SHA-256 `de253755878148bff876b620f60f6ace059912a3c6f59b53f662433b74790aa3`  |

Exact source, job, API digest, archive CRC and member hashes were checked. Local receipts and complete TAP outputs remain under `.cache/solo-followup/92ff-required-checks/`, `modal-lazy-boundary-34d95/`, `external-backup-lazy-boundary-34d95/`, `library-first-use-hosts/` and `library-late-ci-first-use/`. These source/model results do not establish native frame timing or qualify a later production package.
