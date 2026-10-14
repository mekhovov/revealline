# Native update integrity rejection and recovery — 14 October 2026

A controlled single-byte update mismatch was rejected by the production offline preparation path. The previously prepared version still opened and retained the installed Reservoir world. Restoring the exact response bytes allowed the same new candidate to prepare successfully; its actual player opened and catalogue Play remained disarmed.

## Isolated journey

The fresh origin http://127.0.0.1:9030 used one stable `/revealline/practice/fpv-worlds/` root and unchanged old/new immutable package directories. Old v0.142.4 binds source `b309f8232ab38b27fe4081466d550f22c63673d3`; new v0.151.1 binds artwork-fixed source `25d086cbd580de5dc5b745ce088af283434df5ae` and Worlds revision `fff1c41f5e63e04848c3e20070383bece6834939e6b117446aa2931b3bcb518d`. Full cloud artifact identities, hashes and harness hashes are in the [receipt](fpv-native-integrity-rejection-20261014.json).

1. Old preparation initially returned an aborted worker registration. Retry reached Ready offline without clearing storage; no cause was asserted for the first abort.
2. The actual old player installed Mountain Reservoir r16: eight challenges, digest `50ffbb0e5da7`.
3. The server advertised the exact new candidate and enabled a fault only for its `site/game/fpv-entry.mjs` response. One space became a tab, keeping HTTP 200, valid JavaScript and the same 8,132-byte length. Frozen files and manifests were unchanged.
4. New Download reported not completed / verification failed. Open prepared still pointed to v0.142.4; clicking it opened the old home. Its Library retained the same eight Reservoir challenges and digest.
5. Fault injection was disabled. A direct response check confirmed byte equality with the frozen file. Retrying the same new candidate reached Ready offline and exposed prepared v0.151.1 plus previous v0.142.4 actions.
6. The actual new action opened the home after the authorized password unlock. Explore showed Reservoir Installed and eight campaign missions. Catalogue Play opened it ready, disarmed at zero seconds, health 100 and throttle zero.

The unchanged file SHA-256 is `53b594e3440257a8212c714f1df17abef80bccd3a36672c53128cc90b79136c2`; the controlled response SHA-256 was `46ef4f366b759c557a9402e8ef8ced76336c9d96f6d93d7be8dd6bc05568017f`. The response log distinguishes the initial non-browser fixture probe from the later native update request. This exercises integrity rejection beyond an HTTP, length or missing-file failure.

## Evidence and limits

Evidence consists of native UI/AX observations and server response/protocol records. An attempted screenshot had a zero-sized surface and is not used as visual evidence. The [separate native rendering receipt](fpv-catalogue-render-20261014.md) remains the bounded canvas acceptance record.

No browser cache, world, recording or worker registration was removed by the harness. No storage filling, eviction, process restart or verification bypass occurred. Existing unrelated servers were left untouched when the initially selected port was occupied. The isolated server remains available with fault injection off.

This is a controlled integrity negative test followed by a normal exact-byte retry in one browser origin. The faulted response itself is deliberately not release-qualified candidate data. The result does not claim real quota/eviction recovery, browser restart, network-wide offline, physical-device performance, every failure path or mission completion. Public admission flags remain unchanged.
