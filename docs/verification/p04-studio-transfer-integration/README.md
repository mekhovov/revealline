# Studio revision transfer — integration

Held follow-up on `02079f9b`; not a public release. Four runtime sources, one regression file and the guide match the sealed UX packet.

Import now preserves complete theme/collection families, bindings and original bytes through namespace collisions and sparse historical revisions. Immutable append validation accepts a contiguous batch while still rejecting gaps, duplicates and rewritten records. Theme menus show one choice per family with IDs distinguishing duplicate names.

The eight-file Node20.19.5 and Node22.22.2 runs each executed79 cases:70 passed and nine production-history cases initially failed because tracked sparse assets were absent. After restoring exact tracked production/art/font files, the12 production-history cases each passed7 and failed5. A separate Node20 run loads the unchanged `02079f9b` model/session bytes and reproduces exactly those five failures: stale ledger reproduction, unrevised effects/screens approvals and an outdated UI approval expectation. This is a known production integration gate, not an accepted full pass; no assertion was weakened. The other67 distinct cases passed on each runtime.

Fresh actual-browser verification on the exact integrated runtime imported two uploaded replacements, found both originals/history, chose the earlier pickup, saved, reloaded and exported. The selected imported theme remains a separate family; all135 payloads and1321 asset records survive. The output file is7,495,596 bytes, SHA-256 `9051e35e7c9be5e030353a8adff1fc19d7d9a38ad5d0f197a2864f8167c81e41`. Every original byte equals the input bundle. Native export event waiting timed out, but the actual download and UI status independently establish completion. No warning/error appeared.

This is bounded mixed-input desktop verification, not physical-device, all-role preview, offline, fullP04 or release acceptance. The temporary server/tab are closed. Screens/effects scoped review and regenerated production gates remain next.
