# Earned pictures in demo playback — 29 September 2026

Follow-up to `39bb06ceaf2c6c769a0308daa090ed5550250141` in held draft [PR #781](https://github.com/mekhovov/revealline/pull/781). No version allocation or publication.

## Corrected behavior

An ordinary completed level can retain its exact release picture and completion receipt without a durable assignment. Demo playback previously resolved that missing assignment to Legacy art, compared it with the earned still receipt, and incorrectly kept the picture concealed. It now acquires the verified earned original in this case. Explicit current pins and replacement assignments still require their own matching earned receipt. No unearned current picture becomes clear merely because its level has been completed.

Session-only originals use Collection's verified session picture view and acquisition adapter. A failed explicit adapter does not fall through to another source; absent, unreadable, foreign or mismatched originals remain concealed.

Personal recordings from installed Journey/company missions now load the actual manifest picture and consult the scoped Solo picture ledger. A matching edition, mission, installed campaign/revision, world and complete asset descriptor are required. Exact originals can be shared across installed difficulties of the same mission. A later legitimate win does not revoke the retained first-earned picture. No other community, mode or replacement image gains access.

The same picture owner persists through watching, completed playback and takeover practice. Simulation, scores, saved flights, unlocks and collection records remain read-only in the demo.

## Focused verification

- Picture resolution, session views and Journey originals: **37/37 passed**. Covers the reproduced no-assignment failure, actual candidate manifest compilation and verified artwork bytes, later wins, difficulty sharing, replacement and foreign-owner rejection, delayed cancellation and single-owner disposal.
- Mounted earned-picture integration: **5/5 passed**. Uses the actual ordinary Ready release PNG and pin, durable history with no assignment, a strictly verified winning replay and production completion award. Both Standard and Gentle host preferences display the Standard-earned original clearly during takeover and completed replay. A separate unearned fresh-practice level remains concealed. Complete profile/storage snapshots and the ordinary checkpoint remain unchanged.

DOM, image decoding and IndexedDB boundaries in the mounted tests are modeled; these are not physical-device, browser-pixel, audio or unfamiliar-viewer acceptance. They do not resolve the earlier visible-return stall or other [release qualification limits](../demo-qualification-2026-09-29/loading-recovery/README.md).
