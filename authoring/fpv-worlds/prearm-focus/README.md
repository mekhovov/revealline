# Pre-arm appearance focus

Changing an appearance before arming restarts scene preparation with `preserveFocus: true`. The late focus operation already respected that option, but the earlier `playShell.enterPlay()` closed the parent menu and focused the viewport. The host now applies the same condition to that early transition. Ordinary Fly and Retry retain their existing navigation. The only runtime change adds 28 original source bytes; audio, physics, course identities, recordings, rewards and package limits are unchanged.

The existing dialogue arbitration diagnostic also needed its initial snapshot. `world-audio` intentionally uses the first update as a baseline, so a saved hostile-fire event cannot interrupt dialogue merely because that snapshot was restored. The existing test now submits frame 0 with that event and verifies no interruption, then submits frame 1 and retains the original fresh-warning interruption assertion. No audio runtime code or new test case was added.

## Source qualification

The unchanged base `ade4bfc2dd2934668889bf622e87a48cf1b52c03` reproduced both failures: 14/16 existing checks passed. The candidate `58d89b606b068be706e1914c4e083a32d7e623fe` passed all 16 existing checks in `game/test/fpv-world-appearance-ui.test.mjs` and `game/test/fpv-hunt-reactions.test.mjs`, with scoped lint, formatting and diff checks. Both original TAP receipts are retained. A separate read-only review found no blocker in the two-file correction.

The frozen browser fixture source is `c205ffd070b753990caee0c2110fc03c38762f85`. Its r2 player reuses 101 immutable members of admitted source `53d3364fe29ced8a4ee22a4a32a96662877d336b` plus one explicitly declared host overlay from 58d. The overlay is 260,599 bytes, SHA256 `848248a069b180b93ef84c090a0f060fcb92ebb4ec67a6d68abbbad52a05c88b`. This is source functional evidence, not admission of that overlay. All 102 player files and four fixture files were hashed in the browser. The fixture manifest SHA256 is `15779ad812fb8863f7a0f716065b815ae2cb0bfd455efc6636b97de9752e3f1f`.

Actual browser r2 passed **145/145 checks**, with no warnings or errors. On the visible native Settings surface, two pre-arm appearance changes retained the same focused select, the selected course, tick 0 and the disarmed state. Settings and its parent Home menu stayed open. Root performed trusted Tab followed by Shift+Tab, returning focus to the appearance select. Closing Settings retained Home. An explicit Continue advanced two native-clock flight ticks; opening the menu paused the flight. A subsequent appearance change stayed pending and preserved the complete paused state. Ordinary Retry closed the menus, focused the viewport and adopted the queued appearance in a new disarmed attempt at tick 0.

Flight options were not visible in this native shell, so their conditional browser branch was **not exercised**. The existing focus diagnostic separately covers the pre-arm selection path. Native IDB, localStorage, rendering, clock and lifecycle guards were not replaced. The fixture observes errors and trusted key events and uses public UI controls plus read-only application snapshots; it calls the ordinary disposal API at completion.

The complete browser receipt is 63,856 bytes, SHA256 `9aea8cde0c3bf5582e2c0b306a5e15799720858b1d48a1038995ca5e4c5c7086`. `evidence/archives.json` pins original and compressed bytes. R1 was retained **unrun**; r2 adds child-window focus reacquisition after the parent Finish control and best-effort failure capture when disposal has removed menu nodes. Neither correction changes production code.

## Integration and reproduction

An ordinary local merge of main `f3764070e22f0b33b63fd0f7434690fa7455dc64` produced `30e54d791f3fcc6266b10f1b6001920c5044d145`, retaining the focused host change and diagnostic. Main also supplies the separately qualified readiness guard and compact generated shell. Evidence commit `8cb06a2ae28c377956c59c949aab2918a1c9991f` passed full `npm run validate`, including EN/UK and generated projections, and the same 16 existing checks on Node 20.19.5. Validation materialization used APFS clones with exact committed Git blob verification for all 4,943 selected inputs; it did not modify tracked source.

All three optional packages passed admission from exact 8cb, with two identical builds, committed-input verification and independent ZIP-member checks. Worlds has 102 files / 15,562,608 admitted bytes; its 95 original inputs total 16,768,770 bytes, leaving 8,446 bytes under the unchanged 16 MiB source limit. Its package revision is `31d056b4b1f0b53300c526b29f97a71a9bb3b8d02979d7344549d60854ea3a51`. The exact host is 260,715 bytes, SHA256 `5b636afefad57c27a917cb0901aa9725f106e86586222d4270179b7fd892b2f0`.

The admitted r1 browser fixture uses all 102 immutable members without an overlay and the same c205 harness/observer as source r2. Its manifest SHA256 is `f7162b3a5f2e57c03dedc931226f75c3ffcf774aca3ca2cd93f26dcbd52860a0`. The actual admitted-player run passed **145/145 checks**, with the same check names as source r2 and no warnings or errors. Root repeated trusted Tab to the next checkbox and Shift+Tab back to World appearance; Finish verified deliberate arming, pause, queued appearance and ordinary Retry. The conditional Flight options branch remained unexercised. The complete admitted receipt is 63,860 bytes, SHA256 `3971e9155418e3dc700cccb85162d413d50c11b84c23e11bfc3f1a231ed66b83`.

All validation/admission receipts, both browser receipts/screenshots and the exact staged-player inventory are retained in `evidence/archives.json`. Scoped ESLint, Prettier and diff checks also passed. This confirms the bounded focus/menu behavior in the integrated package; it is not an offline, mobile, controller, performance or full D6 acceptance claim.

To prepare another immutable source fixture:

```sh
GIT_NO_LAZY_FETCH=1 node authoring/fpv-worlds/prearm-focus/prepare-browser.mjs ABS_ADMITTED_PLAYER ABS_NEW_DIRECTORY EXACT_COMMIT
```

The admitted player must have its original sibling `.json` staging receipt; preparation verifies every member and refuses to replace an existing output. An exact newly admitted player can use the final `admitted` argument, which prohibits an overlay and checks its source revision and host bytes. Serve the output on a dedicated local origin. Click **Run focus checks**, perform the requested native Tab / Shift+Tab checkpoint, then click **Finish focus checks**. The complete receipt is exposed in the readonly `receipt` textarea.

This bounded check does not establish mobile/controller usability, offline recovery, full route completion, performance improvement or the full deferred D6 qualification.
