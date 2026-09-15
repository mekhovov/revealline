# P03 R5: first Ready focus in Versus

Local source candidate on exact P08 static baseline `1da77ee586d0fdd3ac73883235a822b959e85b37`. The host gives an untouched first prepared lobby one focus handoff to visible, enabled Start. It does not activate a controller, begin a race or continuously enforce focus. This work does not complete P03 or qualify a release.

Initial intent is captured before the launcher can hide a deliberately focused recovery link. Deliberate focus, blur, hidden state and pagehide permanently relinquish that intent. The handoff requires the same initial match/generation, successful picture preparation, Ready/main state and available Start. Hidden/inert/ARIA-hidden, layout rectangles and CSS visibility are checked. Error and cancelled preparation do not focus disabled Start. Boot observers are removed after that one attempt.

The P08 required-picture selection, immutable choice, Cancel/Retry focus ownership and Start-intent epochs remain unchanged. Later operations retain their own focus and lifecycle authority. The shell regression now checks initial Start, Shift+Tab to Team, Tab back to Start and then Race setup; native menu order is unchanged.

## Automated evidence

[Final verification](retained/verification.json) and [execution](retained/execution-final.json) record **141/141 passing on both Node 22.22.2 and Node 20.19.5**, zero failures, skips or cancellations. These are six complete files: initial-focus host, Couch shell/navigation/static-picture host/input, and shared controller-navigation. Node-reported runtimes were 77.590 s and 74.716 s; measured process wall times were 77.916 s and 74.785 s. [Static checks](retained/static.json) passed lint, formatting and whitespace for their declared inputs.

The new 15-case host file covers immediate/delayed boot, deliberate current/abandoned/recovery focus, background loss, unavailable controls, boot error and required-picture refusal. It uses real Couch/duel/reader/navigation code with finite DOM/media boundaries. Four declared owned file pins were stable across the final pair; that is not a complete transitive-source proof. The runtime and two test files remain exact. The fourth pin was the earlier [held README](retained/README.source-held.md), preserved before this evidence-only update.

Retained failures remain distinct: the first authoring run used a nonexistent harness `slots()` accessor; that fixture mistake is not a game defect. The [corrected baseline](retained/baseline-corrected-node22.log) reproduced two missing Start handoffs. An initial 140/140 whole pair preceded explicit pagehide invalidation. The [targeted pagehide-return failure](retained/pagehide-before-node22.log) led to the final observer correction and 141-case pair. Counts are not additive. [The map](evidence.json) records raw hashes and the trailing-whitespace normalization of three diagnostic logs; their original cache files are unchanged.

## Scoped native review, 2026-09-15

Root reviewed desktop Chromium through actual keyboard actions on the exact SHA-bound overlay: `game/couch/couch.mjs`, 46,983 B, SHA-256 `623ecf47c710b535583cd83bf042c72cbfbfc6dc6622e43fb46d27f5a6ebc502`, with every other allowed route from exact 1da Git. The [root receipt](retained/native-root-verification.json), [12 events](retained/native/events.json) and two original screenshots retain that scope.

A fresh ordinary visit focused enabled Start. Tab/Enter opened Race setup, Escape returned to its opener, Up selected Start, and explicit Enter started both boards with canvas focus. Escape paused with Resume focus. A second fresh normal visit again focused Start. See [fresh Ready](retained/native/fresh-ready.png).

The separate [timing fixture](retained/preview-delayed-binding.json) delayed only the existing 52,720-byte required PNG response by six seconds, before response headers; image bytes and other routes were unchanged. During boot, Tab selected the recovery link. After that link disappeared, another Tab selected the Team link while the picture was still preparing. Picture readiness preserved that deliberate focus. See [deliberate Ready](retained/native/deliberate-ready.png). This is not a production-latency measurement or app-state injection. Event 9's intent label is annotated: boot had finished, but the picture was still loading; readiness is event 11. AX snapshots and subsequent DOM reads are sequential, not atomic.

The original missing-focus observation belongs to f61 + A1, not this baseline: `.cache/worktrees/p03a1-mode-departure/.cache/p03a1-mode-departure/native-root/events.json`, 41,026 B, SHA-256 `9205fe4208242b6da2dfd0848db4113f343157d2dda69e5144f9f3295b1857e7`. Its first two events recorded prepared active ID empty, then first Tab reaching `race-coop`; the unrelated Team package is not copied here.

## Composition and limits

A1 is based on f61 and owns fixed departure routes plus small Couch getter/pause/lifecycle hunks. R5 is based on 1da and adds only boot focus authority around P08. Compose by hunks, preserving P08 asynchronous Start interruption/captured-controller guards and A1 current match/generation departure guards; run the combined host checks. Team E/I, Solo R1/K and Team picture/registry work are outside this patch.

Source peers and root native review cover this bounded candidate. Whole-source CI, the composed A1 host, publication, physical controllers, touch, responsive device layouts and BFCache qualification remain open. The modeled background/pagehide/error cases are not additional native observations. No simulation, scoring, replay, storage or version changes are claimed. Original receipt paths remain cache-relative; [evidence.json](evidence.json) maps every copied file and explains the historical README and three text transformations.
