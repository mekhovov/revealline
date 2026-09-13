# First-earned picture receipts

Opt-in `xonix-library.v3` adds `pictureReceipts` beside the existing progress, gallery, scores and mastery metadata. The ordinary empty library stays v2. Old v1/v2 imports retain their existing migrations; adding the new field to an old format is rejected.

A caller supplies verified `presentationPins` and `mediaIdentityCatalog` to `recordLibraryCompletion`. A new gallery identity receives its first picture choice in the same returned library as its completion and score. The host then uses its existing single guarded profile write. No IndexedDB write occurs at victory: immutable media originals must already exist before flight preparation.

Later better scores may update the gallery's statistics, but never replace its first-earned receipt. The receipt stores gallery identity, original earning run/time, seed, body and exact presentation choice. Standard/Gentle and different worlds retain separate receipts. Existing gallery rows without a receipt remain earned authored artwork and are never retrospectively assigned current managed images.

Ordinary concurrent merge preserves the already committed remote receipt, or its implicit authored-art choice. It adds local receipts only for gallery identities absent from the remote profile. Explicit import/replacement/Undo adopts the selected document through the existing generation mechanism. The complete library remains capped at 4 MiB, with at most 4,096 receipts and 2 MiB of receipt metadata; oversized data refuses without dropping earned records.

Receipts require a completed gallery identity and matching map/world. They can be imported and retained when gameplay packs are absent. This does not establish media availability or global score authority. Runtime resolution must verify their exact retained authored owner/revision/hash and original bytes, and must not substitute a current assignment. Replay and pack-dependent animation require their original gameplay content even when the stored still remains viewable.

The source model passes 64 affected Node 22 tests, including six new cases with real kernel wins, Standard/Gentle, worlds, better scores, concurrent merge, old-format refusal, portable round-trip and one-write/quota behavior. All six new cases pass Node 20. Actual host award, Collection display, paired original-media restore and browser offline journeys remain integration gates.
