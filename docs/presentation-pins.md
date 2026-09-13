# Saved-flight picture choices

The opt-in `xonix-session.v3` adds `presentationPins` outside the existing replay. `suspendSession` requires explicit continuation and a matching execution/map/world identity. Old v1/v2 sessions keep their exact release and continuation paths.

`createPresentationPins` captures all installed themes once from validated media and execution catalogs. Each choice is either explicit authored artwork or one exact immutable presentation revision and original asset hash. New assignments affect new attempts. Switching worlds or restoring a flight must use these captured choices. Standard and Gentle share their verified authored picture owner while retaining distinct gameplay execution identities.

`snapshotPresentationPins` owns and validates at most 8 KiB and 64 unique theme choices. The existing 2 MiB local session slot and overall replay import limit remain unchanged. Invalid or over-budget data is refused, never trimmed. `restoreSession` requires `mediaIdentityCatalog` for v3 and verifies every choice against the restored campaign after replay verification. It does not look up current assignments or decode images.

`resolvePinnedPicture` resolves the retained revision/hash only. Missing managed media returns `unavailable`; it cannot select a newer assignment. An absent theme is an error. Legacy choices retain the existing authored path. A successful metadata lookup is not proof of original-byte availability or successful image decoding.

Runtime integration must forward the verified catalog through every restore, backup, transfer and Undo path. A host must prepare and verify/decode originals before flight/Resume, guard late results by run/map/theme/generation, and offer explicit retry or labelled authored fallback. It must preserve the pin in saved data even when fallback is selected. These source APIs do not yet change ordinary gameplay or Collection; first-earned receipts, original-media transfer and runtime adoption form the next complete milestone.

Verification: 39 session/picture tests passed on Node 22, including old mastery continuations and v1/v2 compatibility; all 10 new picture tests also passed Node 20. Checks cover Standard/Gentle and both turn policies, assignment A→B, explicit legacy worlds, stale/missing identity, bounded originals metadata, quota failure and unchanged replay checkpoints. Independent source review found no blocker. Physical browser adoption remains pending.
