# Controller review refresh — 2026-09-29

## Reviewed snapshots

- PR783 aggregate: 0cc7337a8e490d73ad9d7718fb5b208aaf7da924.
- PR782 scoped source: d89af8ea47d3ed8210df6bb2a3e5ccbdc2d6517c.
- PR781 Demo Back follow-up: d8d51e8630a30c8bb2b2391b80a95dbd6beab75b, currently based on the PR783 branch.
- Latest main used for comparison: 6a67d6dbfe01d5e1f3842b5a79dd5d5ddeefcfd8.

Read-only review of pinned source and tests, plus bounded existing-test comparison. No source, worktree, Git or PR mutations. Temporary adapter/test copies and logs exist only under /tmp.

## P1 — PR783 still discards Creator Start's Confirm release tail

At game/creator/player-navigation.mjs:96, every refresh hard-cancels the lifecycle. Line106 refreshes on the menu-to-flight transition. This removes the guard tail immediately after the release-committed Start action.

A separate route exists before that next RAF: line31 calls lifecycle.beforeNativeActivation unconditionally, including flight. The context at line82 reports flight inactive. Shared controller-confirm-lifecycle.mjs:86–88 responds to this by hard-cancelling; its line64 calls guard.cancel with suppressTail:false before the guard decides whether to consume that very Enter/click. A Steam Input native release echo therefore escapes the just-committed Start gesture.

PR782 already has the correct adapter protections: player-navigation.mjs:31–33 avoids menu sampling in flight, line98 uses soft refresh cancellation, and lines120–122 avoid dispatching stale menu edges after a synchronous scope transition. Its test at game/test/creator-player-navigation.test.mjs:184–187 checks Start-release Enter suppression and line192 checks no flight-native pad probing.

**Reproduced:** the existing PR782 tests were loaded unchanged except import locations, against each pinned Creator adapter with identical clean PR783 dependencies. The PR783 adapter fails line184 with “the just-released Start gesture still drains native echoes” (false !== true). The PR782 adapter passes. Both pass the separate native Confirm tap-between-frames test.

Required integration: reconcile the tested PR782 adapter/test rather than retaining PR783's hard refresh and unconditional flight-native probe. This is an aggregate admission blocker; it does not affect the already released Steam Deck patch.

## P1 — PR781 Demo Back still bypasses shared native-event ownership

PR781 game/ui/demo-input.mjs:75–78 installs the keydown listener on window; line154 makes it a capture listener. Lines102–114 recognize Enter/Space on data-demo-exit before the ordinary Demo UI wrapper bypass, consume the event and invoke Back immediately. The code contains no shared Confirm/native-event ownership hook.

Window capture runs before the document Confirm guard wired by PR783 app.mjs:2316–2320. Thus an A-related Enter/Space echo can exit Demo on press before the release transaction/guard sees it. The existing tests at PR781 game/test/demo-input.test.mjs:429 prove ordinary keyboard Back and trailing-key suppression, but do not combine this handler with the shared Confirm lifecycle or pre-RAF Gamepad interleavings.

PR783 still has the older wrapper-first branch at demo-input.mjs:102–117. Its real Back control is within data-demo-ui (index.html:2746–2761), so it avoids PR781's newly reachable keyboard branch but lacks that follow-up's ordinary keyboard fix. This does not resolve the stacked integration finding.

Required integration: preserve the ordinary keyboard repair while routing ownership through the shared coordinator before invoking Back. Cover Gamepad-first and pre-RAF native-first orders, hold/release, and restored Home focus with the combined host. No new physical Deck reproduction is claimed for this Demo finding.

## Earlier aggregate-wide protocol rollback finding is resolved

The old statement that the aggregate still uses the obsolete frame-only protocol everywhere is no longer accurate at PR783 head0cc7337.

- Shared lifecycle and diagnostics trace now match current main byte-for-byte; the guard matches current main too.
- Router retains readMenuConfirm/confirmSnapshot. Its reviewed difference is the additive spectator input mode, not removal of the Confirm snapshot protocol.
- app.mjs:2316–2341 wires native-event sampling and the coordinator; :2701 observes native input before clearing; :3103 uses lifecycle cancellation.
- app.mjs:9418 samples the current Confirm snapshot before Demo dispatch; :9461 and :9471 dispatch other edges with confirm:false.
- The Demo menu callback at :11830–11831 also uses confirm:false instead of the removed confirmStart/confirmCommit/filter adapter.

The remaining Creator and Demo issues above are specific host-integration gaps. Refresh old intake README language so it does not claim that the core sample/cancel migration remains wholly absent.

Additional reconciliation detail: PR782's guard has a small reset fix that preserves programmatic activationDepth through synchronous blur/child-frame transitions (controller-confirm-guard.mjs:167–172). It is not yet in PR783/current-main guard. Carry its scoped regression evidence during integration rather than replacing the latest scoped guard wholesale; this refresh did not independently rerun that scenario.

## Exact bounded check and evidence

Node v20.19.5. Both temporary test files contain the same existing PR782 test source; only relative imports/import.meta.url were relocated. Each imports its exact pinned adapter. Shared navigation/router/guard/lifecycle/authoring-source modules, DOM helpers and Creator HTML were byte-checked against PR783 before the run.

```sh
node --test --test-name-pattern='custom menu owns controls|creator menu captures a native Confirm' /tmp/creator-refresh-783.test.mjs /tmp/creator-refresh-782.test.mjs
```

Result: 3 selected passes, 1 selected failure, 6 unrelated skips; exit1,267ms. PR782 contributes2passes; PR783 contributes1pass/1failure. This is a controlled adapter comparison, not the full PR782 host suite.

- TAP: /tmp/revealline-refresh-controller-tests-20260929.tap
- Pinned refs, command, dependency comparisons: /tmp/revealline-refresh-controller-tests-20260929.json
- Temporary sources: /tmp/creator-refresh-783-adapter.mjs and /tmp/creator-refresh-782-adapter.mjs
- Temporary existing tests: /tmp/creator-refresh-783.test.mjs and /tmp/creator-refresh-782.test.mjs

No broad suite, build, browser or physical Steam Deck acceptance run was performed. Keep PR783 and PR781 on hold for their owner-scoped fixes; preserve current release and avoid broad stale aggregate adoption.
