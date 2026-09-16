# Title Start/Continue candidate evidence

This internal P03 work package makes one deliberate Title Start launch the named mission and one Title Continue resume the retained or verified saved flight. Generic Library/Load remains paused. It is based on `c7f4faae318d58eacab140c1b2913e620e15efb7`; it does not establish integrated P03, device or public-release acceptance. See the [behavior and reusable authoring prompt](../../../title-start-continuation.md).

The [evidence map](evidence.json) pins 55 original cache files as 54 retained files, including one byte-identical screenshot shared by both native records. Logs, event records, predecessor source and helpers are losslessly compressed with gzip. The map records both original and retained hashes; decompression restores the original bytes without whitespace changes. Receipt paths retain their historical cache locations. Match their hashes through the map rather than resolving an earlier `verification.json` or log name against its successor.

## Final source and automated checks

The [final execution receipt](retained/verification.json), SHA-256 `45ae5ae979d1b9b83346ea9844716e69de53220431ec4294372046d1bca56b26`, records 11 complete test files on each runtime:

| Runtime      |  Passed | Failed / skipped / cancelled | Test runner duration | Measured elapsed |
| ------------ | ------: | ---------------------------- | -------------------: | ---------------: |
| Node 22.22.2 | 187/187 | 0 / 0 / 0                    |            119.790 s |        120.093 s |
| Node 20.19.5 | 187/187 | 0 / 0 / 0                    |            139.784 s |        140.071 s |

Both original logs are retained: [Node 22](retained/whole-node22.log.gz) and [Node 20](retained/whole-node20.log.gz). The receipt contains the actual command and all 15 listed source/test pins; those pins remained unchanged across the runs. This is a focused compatibility boundary, not the full repository suite or a complete import-graph qualification. Earlier subsets are not additional final coverage.

The final runtime hashes are:

| Path                         | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `game/app.mjs`               | `2781cea918d2b62e74cac015d62658d8750712b60b3debb3b0a3dde88178fa91` |
| `game/index.html`            | `538e4c50d24666fb3d34d6ddd69db1e72e623e842b5cebed645fff33880a3547` |
| `game/ui/game-shell.mjs`     | `ee4fadd514db831d656abc6da58db38827654dbaf9207202e297ce1c466f256c` |
| `game/ui/field-kit-copy.mjs` | `f3ac3bed3a344934cf72990c1a9b37833320ecee1e05393cc1cc42166fe1ae23` |

The actual host cases exercise Immediate and Grid + buffer saved cuts, pending turns and unchanged saved bytes; ordinary paused Load; changed saved slots; held original-picture decoding; cancellation and lifecycle interruption; terminal Start; storage refusal during restore status; and synchronous focus changes while Cancel disappears. Browser/media boundaries are modeled. The new Title file contributes 44 cases including nested cases. The final pair also covers ten existing host/continuation files. The [two-file static receipt](retained/title-focus-static.json) records lint, format and whitespace checks for the final focus correction; [packaging validation](packaging-validation.json) records the broader final static check separately.

## Native desktop observations, 15 September 2026

The [final native receipt](retained/native-focus-root-verification.json), SHA-256 `cd7283d1ee4769f90219b1208fbed4b447236f6f99ebd26308e9047e4f8cfc86`, binds the final four runtime pins to 15 [event observations](retained/focus-native/events.json.gz) and four image references. Root performed the keyboard interactions and reviewed the screenshots.

- A six-second delay on the exact First Signal picture left preparation status and focused Cancel inside Title. Event 03 is already running: the response finished before the attempted Cancel. The historical `cancelled-title.png` filename and intended action do **not** prove cancellation.
- A fresh origin with a 20-second delay allowed an actual keyboard Cancel. Events 08–10 show Title at briefing with Start focused, including after the delayed response completed: there was no late Start. Another explicit Start began play. See [after cancellation](retained/focus-native/cancelled-after-download.png).
- Main menu Continue resumed the retained paused flight with one activation. A full reload offered Continue without automatically loading or starting; explicit Continue then restored and started it. Explicit Pause remained available. The final focus pass used a stationary fresh flight.

The artificial delays affected only the unchanged 40,810-byte, 768×576 First Signal PNG, SHA-256 `c1aedf89bc3433dc1cb60998fa1e2563480a590c38586332f444c4c12c772fce`. Its exact owner and compiled asset tuple are in the [preview inputs](retained/title-focus-preview-inputs.json). The normal, six-second and 20-second bindings and helper source are retained separately. No application state or browser storage was injected, and no image was transformed. These are timing fixtures, not measured network or hardware performance.

The earlier [26-event native receipt](retained/native-root-verification.json) and [original events](retained/native/events.json.gz) remain separate. Events 1–17 bind shell `66fc9011…`, and 18–26 bind `8e5442e6…`; neither is the final `ee4fadd5…` shell. They include movement, an actual 52.2% win and fresh named-mission Start after the result. Their annotations correct intended running/pause labels that actually observed a won result, and an attempted Cancel that completed too soon. Exact queued-cut restoration is established by host tests; the final native focus pass is not a new native queued-cut proof. AX snapshots and DOM focus reads were sequential, not atomic.

## Preserved failures and scope limits

The [focus predecessor record](retained/title-focus-predecessor.json) preserves the 183-case run with 163 passes and 20 reported failures, including parent/subtest totals. Those focus expectations used synthetic clicks without first focusing the primary action. The fixture now models focused keyboard activation without changing general synthetic-click semantics. Four stronger callback cases then produced [42/44 on the old shell](retained/title-focus-before-cleanup.log.gz): two actual Cancel cleanup paths stole focus after synchronous focus/background changes. The corrected shell passed [44/44](retained/title-focus-corrected-node22.log.gz), followed by the final 187/187 pair.

Other earlier logs retain the missing sparse module, invalid terminal fixtures, obsolete Continue-paused expectations, frame timing correction and intermediate work. Their raw failures are preserved, not promoted into final verification or dismissed as one common cause. The terminal fixtures ultimately produced actual modeled wins and losses. The final source also cleans up a restore whose status observer throws, allowing a fresh Continue afterward.

This package does not certify physical controllers, touch devices, phone/portrait/zoom layouts, accessibility conformance, production artwork readiness or a public build. The preferred Arcade default, clearly labeled three-mode Title/common Couch lobby and final composition with other P03 candidates remain separate. No version, simulation, save schema, production approval or release selector changes are part of this work package.
