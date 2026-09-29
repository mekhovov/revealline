# Native menu follow-up: input safety, states and portraits

Base: `10f9bf21e`, the scoped #782 input reconciled with accepted main `b5ab06e1`. Checks below ran against the working source corrections committed with this report. Older mixed-snapshot evidence remains separately attributed.

## Implemented batches

- Downloads, profile recovery, Replay Theater, Pictures & Stories, Video Poster and Enemy Workshop use the accepted Confirm lifecycle. Native compatibility clicks cannot repeat a controller action; release commits once and blur/modal changes cancel ownership.
- The shared guard now preserves its synchronous activation depth across blur/visibility resets. Previously a click that focused an iframe reset depth to zero before its `finally` decrement, preventing later controller actions. Two regressions reproduced the failure before the fix; the fix leaves the lifecycle API unchanged.
- Authoring pages use an element keyboard scope. Arrow navigation and Back work outside dialogs while text caret and canvas editing retain their own input. Controller Practice opts out of generic preview injection and retains its session-checked child bridge.
- Community and Controller Practice mount the existing shared input host. Dynamic catalog controls, field editing, nested cancellation and iframe ownership are covered by local fixtures; no authenticated Community action was submitted.
- Disabled menu actions remain muted/dashed across all three hosts, including edition paint. Forced-colors rules preserve masks, selected state, focus and text title fallback. Browser forced-colors acceptance is still pending.
- Inventory evidence distinguishes historical snapshots, generated routes and the pending Demo tool. Manual authoring runners omitted during isolation are restored from preserved `517df7649`; the absent Demo workflow is omitted from the active runner. The historical download verifier remains explicitly tied to its old files/session.
- Five Dutch campaign portrait profiles are corrected; see [the portrait report](../menu-portrait-motion-2026-09-29.md).

## Automated and source checks

These are distinct invocations; overlapping cohorts must not be added together.

| Check                                                                         | Result                                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Input adapters, authoring keyboard, Confirm guard/lifecycle and support pages | 147/147; [output](input-tests.tap)                                                                                  |
| Actual support/workshop owner regressions                                     | 56/56; [output](owner-tests.tap)                                                                                    |
| Font coverage/license/hash, compatibility and inventory route closure         | 7/7                                                                                                                 |
| Full-source Workshop and Settings surfaces                                    | 10/10; former sparse inventory limitation resolved                                                                  |
| Portrait scene/motion/receiver                                                | 46/46; includes real crop intersection for 102 animated profile/viewport combinations                               |
| Edition runtime projection                                                    | 9/9                                                                                                                 |
| Full localization check                                                       | Exit 0; [10,888 messages / 8,560 references](localization.json), with exact catalog and content registry comparison |
| Changed source formatting and lint                                            | Scoped checks passed; final combined check recorded in PR handoff                                                   |

## Fresh browser evidence

Observed in the Codex in-app browser against the managed worktree's source server on port 8983:

1. Default FPV / LINE landing exposes Title, Solo/Versus/Team, Start, Select Mission, Settings, Sound, Fullscreen and passive song/version information; no old miscellaneous landing panels appear in the accessibility tree.
2. The production-CSS state fixture reports **9/9 standard-color checks** across Solo, Versus and Team. Disabled targets remain 56px high, muted and dashed; enabled primary controls remain yellow; icon masks are present. It reports `forcedColors:false`. Chrome could not run a forced-colors check because its profile/setup screen blocked navigation; browser defaults were not changed.
3. Picture Creator's restored test-only virtual-pad fixture selected a bundled picture through the in-app library, generated, reviewed, approved and exported the campaign. It reported PASS. This is browser-rendered virtual-controller evidence, not physical-pad evidence.
4. Native keyboard arrows/Enter installed that exact campaign, reached its Play link, opened the installed player, started the mission and paused with Escape. The page reported “Unfinished attempt saved on this device.” Reopening the exact edition exposed Resume saved attempt. A simultaneous second tab correctly reported session-only saving ownership. The first test tab was then closed; no saves were cleared.
5. The exact 1,464,809-byte exported `.rlpack` was re-imported through current `importCreatorBundle`, including verified route evidence and full ImageIO pixel decoding. [Artifact receipt](creator-export.json) records its SHA-256 and edition identity; input files were not modified.

This is a mixed virtual-controller authoring plus keyboard play journey. It does **not** establish complete keyboard-only and controller-only create/edit/validate/save/reopen/export acceptance for every tool. Invalid-input and cancellation coverage in the automated cohorts is not substituted for that remaining browser matrix.

The custom Solo player exposed another Phase 2 gap: its installed-player shell still displays setup controls directly instead of the agreed native landing. Its existing navigation and save ownership work, but the presentation adapter remains the next source batch. Team and Versus custom routes already use their native game shells.

## Release boundary

### Support-page package correction

An in-memory standalone compile of the first pushed batch (`88ce620f4`) caught an actual admission failure: Controller Practice imported the authoring source picker, which pulled `dawn-signal.png` and `dawn-signal.mp4` into a player edition without media-admission records. The compiler correctly rejected this with “Player media must belong to the approved asset closure.”

The correction extracts the common owner into `page-input-host.mjs`. Authoring retains its source-picker wrapper and single document owner; support pages import the common owner without authoring sample media. Dynamic CSS and sparse authoring dependencies follow the new module. No asset-admission guard, production manifest or ledger was changed.

Verification of the frozen correction:

- 27/27 focused authoring-input, support-input and edition-runtime tests; 2/2 sparse catalogue Python tests. Scoped lint, formatting and diff checks passed.
- The Controller Practice dependency closure includes input navigation and field-editor CSS, with no authoring samples or manual test fixtures; projected imports have no missing targets.
- `compileEdition` for Coupa Village succeeded in memory: 558 engine inputs, 599 output files, 61,475,615 bytes (under the 64 MiB limit). Inputs were the exact `88ce620f4` package plus this bounded runtime correction; the concurrent custom-menu locale build was replaced with its `88ce620f4` bytes for this verification only. This did not write a package or establish acceptance of every edition.
- On the default landing, trusted keyboard Enter entered fullscreen, Escape exited it, and focus remained on the fullscreen action. This verifies the IAB keyboard path, not browser activation from a physical controller.

This report is local candidate evidence. Physical controllers, Steam Deck/native webviews, mobile frame-time/memory, forced-colors browser rendering, every final edition package and the published build remain separate gates. #782 is a draft aggregate input assigned to v0.150.0; no version or public deployment is created by these commits.
