# Demo drawing-surface recovery

Demo previously kept advancing spectator or practice state after its display or an owned painter surface lost context. The focused tests reproduced both checkpoint changes on unchanged source `de7a9fd3c886f5340cf13e8ec2758833a361a083`.

The correction pauses through the existing interruption owner, clears input and clock debt, and blocks Demo Resume, takeover, Next and return while a current surface remains lost. Display loss survives reopening the same canvas. Each prepared painter owns its loss set; released painters and retired surfaces cannot affect a successor. Restoration queues one paused repaint after synchronous owner callbacks, including restoration while hidden followed by visibility, resize or fullscreen changes. Playback still requires explicit Resume. Required preparation can finish after a reopened display restores, and Fresh can hand off to the independent main-game renderer.

| Complete-file observation                                       | Result                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| Initial unchanged-runtime recovery tests                        | 1/7 pass, 6 fail                                           |
| Expanded unchanged-runtime recovery tests                       | 1/9 pass, 8 fail                                           |
| First corrected-runtime recovery file                           | 8/9 pass; reopening assertion lacked public readiness wait |
| Final corrected recovery file                                   | 9/9 pass                                                   |
| Retained-presentation / clock / picture / media-admission files | 2/2 + 20/20 + 28/28 + 7/7 pass                             |

The final selected focused evidence is **66/66 across five complete files**, with no skips, cancellations, resource stops or surviving owned processes. The first failed green is retained. Its fixture correction adds the existing public `ready()` wait before the unchanged reopened-painter assertion, retaining the product readiness deadline. The earlier test draft also received an explicit scalar tick capture after the initial red closed; `authoritativeCheckpoint` supplies checkpoint hashes rather than a tick property. All original results remain in [the evidence JSON](solo-demo-context-recovery.json).

Exact final SHA-256 identities:

- `game/ui/demo-host.mjs`: `387fa2259d8dfcecabedaa637821ab1afd2113cfa00d1f14b4394b86b1ef3f4e`.
- `game/test/demo-context-recovery-host.test.mjs`: `6197c378654a43c2951e4a5f12cae5ee877be4e776f0bb371d6bfbcff0b9080c`.
- Final recovery receipt: `92d394ab2f4391c0c11741bb432d3a3200a41778cabab200fe27f26c7c39b184`.
- Four supporting complete files plus first failed green receipt: `47db3310878942266b11523cb791b6ea4c46a7823957330fdbee8d5992d418d6`.
- Scoped lint, formatting, syntax and diff-check receipt: `7d6c1d7a588d9fe52a3e0307a2e3d07af262aee44e4c58701657d6150fc1115a`.

Node 22.22.2, `CI=1`, serial complete files, unchanged 600-second / 4-GiB process-group / 16-MiB TAP bounds. Runtime bytes stayed identical across both green observations and scoped checks. Tests use the actual application, replay/practice owners, painter callbacks and shared media admission with modeled canvas/input boundaries. Native GPU recovery and device performance remain pending; this is not thermal or offline qualification. The new file is an addition to, rather than a replacement for, the historical 1,948-file regression inventory.
