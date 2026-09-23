# Sprite history focus correction

Undo/Redo disabled the currently focused button at the end of history, dropping keyboard focus to the page. The correction enables and focuses the remaining history action before disabling the endpoint. Normal focus reveals that control after screen rotation. If neither action remains, focus returns to the canvas. Pixel data, history and other focus owners remain unchanged.

The runtime preimage, editor and modeled DOM helper are byte-identical on integration base `64ec9fd2` and native-preview base `20370a6`. Native evidence overrides only `sprite-panel.mjs` on the latter. This is not final release or public qualification.

## Verification

The same nine new focus/pixel tests plus six unchanged editor tests run on Node 20.19.5 and 22.22.2. Baseline: 11 pass and four expected focus failures. Final candidate: 15 pass, zero fail. Scoped lint and formatting pass. Tests cover exact pixel restoration, history endpoints and intermediate states, canvas shortcuts, unrelated/newer focus and successor callbacks.

The first candidate fixed focus identity but used `preventScroll: true`. Native 390×844 → 844×390 rotation left the successor offscreen. That failed iteration is retained in `iteration-1`. Final normal focus passes actual Enter-driven Undo/Redo with visible successors after rotation. Inline screenshots were inspected; no exported screenshot hashes or physical-device claims. Two DOM rectangle reads timed out; accessibility snapshots and screenshots establish visible focus, not numeric target measurements.

See `studio-pixel-focus-native.json` for source identities and limitations. The final HTTP receipt contains 185 source-matched paths with zero mismatches. Raw receipts retain their original bytes.

The surrounding unmodified Studio workflow also passed upload, staged revision, local save, reload, collection export/import and damaged-file rejection. All 133 payloads (4,009,983 original bytes) and 1,694 asset revision contents are preserved. Two new IDs are intentionally namespaced on collection adoption; this is not exact historical theme-pin restoration. A damaged-byte import was rejected and subsequent export was byte-identical to the pre-failure export. These broader observations support integration but are not outcomes of the focus correction.

No game version is allocated in this draft. Final integration requires the next coordinated version, full source/build checks, immutable release, Pages and public verification. Existing tags/releases and reviewed draft heads remain unchanged.
