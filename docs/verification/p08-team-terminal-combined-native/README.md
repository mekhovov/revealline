# Team terminal HUD and footer: native verification

The combined candidate shows terminal results consistently in both player HUDs,
the footer status and the named player summaries in Help. Retry restores active
guidance. This is a bounded local native-browser check, ready to accompany the
source change through integration; it is not public-release or full P08 acceptance.

The browser served exact source `fc847b18817e1cebb1439b3391e1f3d8aa7361fd` with
one override, `game/couch/relay-rescue.mjs`, SHA-256
`7e5c1dd116c788b1738872038b7270d431fdb284a5dd0ac66aed3229748d58b1`.
Every recorded served binding was independently rehashed against that exact Git
source or the pinned override. [Source and evidence pins](pins.json) record the
counts, raw ledger identities, fixture identity and screenshot hashes.

The [native journey](journey.md) distinguishes the actual inputs and observations.
The [receipt](receipt.json) records what the artifacts establish and their limits.
The [earlier baseline/HUD-only diagnostic receipt](baseline-hud-only-receipt.json)
is preserved as a formatted copy with its original raw-file hash: the original baseline offered rescue after terminal loss,
and the first HUD-only candidate still had stale footer guidance. Neither is
substituted for the combined result.

At 1280×720, the loss and win screenshots visibly show the corrected full player
HUDs and footer. The 568×320 result screenshot covers the HUD/footer with the
results panel. Its DOM snapshot establishes compact state attributes and no
horizontal document overflow; it does **not** establish visual compact-HUD
readability or unobscured controls.

Inputs were ordinary pointer and keyboard actions in the local native browser,
using an explicitly labelled QA pack imported through the game UI. Its stationary
markers and empty low-quota victory arena make terminal states easy to reach; they
are not production missions or evidence of campaign balance. There is no claim of
physical controller, Steam Deck, touch, zoom, screen-reader announcement, offline,
deployed-byte or whole-game qualification. Only the combined candidate's empty
console capture is available here.

The original screenshots, accessibility trees, DOM snapshots, server receipt and
served ledger remain under the local evidence directory
`.cache/p08-team-terminal-combined-native-fc847-r1/`. The earlier raw evidence
remains under `.cache/p08-team-terminal-hud-native-fc847-r1/`; its independent
receipt is `.cache/p08-team-terminal-hud-native-packet-r1/raw-ready.json`.
These local paths are provenance, not links expected to work in a public build.
No screenshots or runtime assets are duplicated by this documentation patch.

The coordinator reported tab 186 closed, server PID 11534 stopped, and the
temporary viewport override reset. Integration, exact-source release gates and
applicable public verification remain separate work.
