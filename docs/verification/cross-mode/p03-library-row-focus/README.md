# Library removal focus

This bounded P03 change restores a logical focus destination after Remove from device rebuilds the installed-pack rows. It starts from `d0925c00518f0be6da0a3ea565112fee106dc8eb`, tree `02342b700c7d9fe7f2f1145161b66d7c8c04b62c`. Only the Library adapter and its internal operation-focus helper change. Existing fixed-target completion and explicit Cancel behavior remain covered by the unchanged operation-focus tests. No storage, gameplay, content schema, version or public-release change is made.

The [evidence map](evidence.json) binds the original inputs, raw test logs, failed/partial predecessor, source holds, preview helper and native records to the lossless [archive](evidence.zip). Historical records keep their original bytes and scope.

After settlement, the adapter checks the actual pack model and the captured Library visit, task and render generation. If the same pack/version remains, it focuses its recreated Remove button. If the selected pack is absent, it uses the next surviving captured row’s first Play, then a previous surviving row’s first Play. A changed version under the selected ID, or no eligible captured neighbor, falls back to the existing Expansion packs section button. Focus does not activate Play. The optional synchronous resolver runs only while the original operation still owns focus; it cannot revive a lease retired by newer input, focus, dialogs or foreground loss.

Removal enters durable commit before awaiting storage. Its Stop waiting action detaches from completion and does not cancel the write or promise rollback. The target follows the actual model even if reconciliation subsequently reports an error. Existing active-pack removal and writer authority remain unchanged.

| Complete affected file            | Cases |
| --------------------------------- | ----: |
| `library-row-focus-host.test.mjs` |    23 |
| `operation-focus-host.test.mjs`   |    27 |
| `library-launch-host.test.mjs`    |    22 |
| `modal-navigation.test.mjs`       |    36 |
| Total per runtime                 |   108 |

Both complete four-file commands passed: Node 22.22.2 in 83.35 seconds and Node 20.19.5 in 85.59 seconds, with zero failures, skips, cancellations or todos. The 285 participating inputs, 15,620,390 bytes, remained unchanged before and after both commands. Runtime binaries, the runner, exact base source and canonical staged path/mode/blob identities were also guarded. Source formatting and lint passed.

The 23 new cases comprise ten actual Solo app/storage cases, six cases using the production Library panel with exact player markup and validated pack models, and seven direct helper ownership cases. The panel cases deliberately test model replacements that the full app does not expose while its durable writer owns the operation; they do not invent a concurrent app mutation API. They include a changed model followed by rejection, same-ID different-version replacement, missing captured neighbors and reentrant/foreign-root refusal. The full-app cases verify stored removal, refused write, unchanged non-active ready flight, detached completion and newer-focus/lifecycle refusal.

The first test launcher was stopped after 14 delivered cases. Two expectations wrongly demanded ordinary success copy after blur/hidden; the existing app reports stale selection authority while reconciling the durable result. A panel test also attempted to focus a disabled tab and produced excessive recursive DOM diagnostics. The original partial log/source and diagnosis are retained. Test-only corrections used the enabled Close control and bounded identity comparisons. A corrected 22-case Node 22 predecessor passed, followed by one additional model/error case and stronger no-steal assertions in the final 23-case file. These historical counts are not added to 108. Neither diagnostic required a production change.

Root’s native run used `http://127.0.0.1:49959/game/`: exact base Git routes plus the two held production overlays. Six HTTP bodies matched their authority before and after the run. There was no application-state injection, game-clock fixture or transport delay. Eight original events and four PNGs record keyboard installation of Night Shift, Living Threads and Fieldcraft, then:

- Middle Living Threads removal focuses Play Fieldcraft.
- Last Fieldcraft removal focuses Play Night Shift.
- Sole Night Shift removal focuses Expansion packs.
- Escape returns to the actual Workshop Scores & saves opener, then Title’s Workshop opener.

First Signal remained Ready at 0:00. Root inspected all four PNGs and found the intended labels and focus visible at 1309×1348, DPR 2. Event 1’s broad fresh-profile inference is explicitly narrowed by event 2: zero scores and no installed rows were observed; this was not a complete Collection audit. Original notes remain unchanged. The packaging peer checks metadata and hashes without claiming an independent visual inspection.

Failure, detached Stop waiting, changed-version and background cases remain host-test evidence. Score/Collection pager focus and other disconnected actions are separate work. This candidate does not include the later current-register commit, P05/P08 composition or the newest P01 correction. Final integration, hosted/build/public/offline gates, mobile/zoom and physical controller/touch acceptance remain open. No P03 phase or release is closed.
