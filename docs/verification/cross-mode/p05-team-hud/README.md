# Narrow Team HUD checkpoint

This source checkpoint improves the HUD at widths up to 600 CSS pixels. Sunflower and Skyline occupy equal halves; their number sits beside their name, and each status uses the full half-row. Shared territory follows beneath. No game state, actor, font size, arena geometry or input adapter changes.

Six final native events and their six original JPEGs are retained. All were visually inspected. At 320×740, both Theme Standard and Theme Large fit the full player names. Plain Large and Ukrainian/Rich preferences also passed the narrow checks. At 390×844 the complete arena remains visible. At 320 with Large text the HUD uses 178.48 pixels instead of the first candidate’s 227.08, with unchanged font sizes.

The first preview’s fractional-DPR captures have duplicated bands and are inconclusive. A fresh tab in the same browser yielded clean DPR1 captures; those predecessor images and the original stylesheet remain alongside the successor. Capture recovery is not a game fix. Large is a text preference, not browser-zoom qualification.

The 844×390 landscape check retains pre-existing vertical scrolling and lower Pause placement; this wider layout is outside the changed rule. Actor readability, full navigation/device qualification and P05 phase acceptance remain open. No public version was allocated for this internal checkpoint. Five exact source/HTTP files matched before and after each bound preview. Keyboard Options, display changes, Back and explicit Resume were exercised; this is not physical controller or touch evidence.

See `retained/root-review.json`, the immutable preview bindings and `retention.json` for exact scope and original-byte hashes. Runtime source is based on d3ff0bc; held02 CSS is 9a4ce18bc5f43587cfafc211230c3a8d639b235af6f17dff79535513e9c29f21.
