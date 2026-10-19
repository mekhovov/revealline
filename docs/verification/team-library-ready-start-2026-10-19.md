# Team library READY and explicit Start correction

This bounded correction restores the existing [Capture briefing contract](../capture-mission-briefing.md) for the native Team mission-library adapter. It is separate from the preview-fixture reconciliation and hardware qualification.

## Cause and source boundary

On captured main `a94f2a6c3dac43ebeead58036a7b890414dfff37`, native library selection called `activateDiscovery(row, context)`. Its default `briefingOnly: false` started the core during preparation. The accepted overlay was already hidden before the first post-preparation frame; there was no second Start/Resume activation. Holding Confirm exposed the missing preparation boundary, rather than causing an input-repeat or timer failure.

Commit `5ac6d674303f9151a68f78f23436bd52fbfb4c0d` introduced the explicit briefing option, and main `e03fdbb5cd73176a01df49347fbe9eab722f1882` retained it. The first-parent diff of merge `e817f5ba34ddafaf7d0b78d8f7e1f7e27d162ef2` removed that adapter option without updating the briefing guide or held-Confirm regression. The reason for that merge resolution is not established.

The production change passes `{ ...context, briefingOnly: true }` to the existing native preparation owner. READY/paused publication, neutral-input gating, focus, immutable accepted recipe, artwork, save journals and explicit Start/Resume continue to use their existing owners. No new input latch, clock, launch handler or recording format is introduced. Title Start, incoming deliberate Play, Retry, Next and continuous continuation keep their separate existing paths.

## Evidence and limitations

The unchanged complete native-input file reproduced **4/5**, with the held-Confirm assertion failing. Strengthening it with immediate READY assertions exposed the same early start for pointer selection as well (**3/5**). After the adapter correction the complete strengthened file passed **5/5**, zero skips. It compares the full prepared HUD, progress, picture and paint through held input and release, then starts the same accepted picture with a fresh Confirm.

Adjacent discovery/library fixtures explicitly perform their real Start/Resume action before their existing running, pause, focus, Retry, continuation and persistence assertions. Preparation additionally checks that its clock and accepted save inventory remain stationary. Fresh Hunt journals retain the existing pre-binding release, and restored journals retain their original ordered commands.

Nine complete relevant native files finished **174/178**, zero skips. Their four failures are unchanged old mission-library inventory counts: `14/12/15/14` expected versus `116/114/117/116` current metadata. Running the complete exact-main library file against unchanged main runtime reproduced the same four signatures (**13/17**). Those counts are a separate fixture task and were not weakened in this correction.

The untouched main preview file stopped all eight cases at its obsolete inventory boundary. This feature therefore stacks on the independent preview fixture PR #1714, exact predecessor `9e9073f3429983cd0357da2bab937ac483db0b97`; its runtime and helper sources are unchanged. The complete corrected-preview file passed **8/8**, zero skips, against this corrected runtime; its evidence is separate from the nine-file cohort. Changed-file lint, formatting and whitespace checks pass. Independent source review is pending. Full current-source validation, native browser review, physical controllers, iPhone PWA/offline, Steam Deck and public release acceptance remain pending. Finite DOM, frame, image and Canvas test boundaries do not establish physical-device behavior.
