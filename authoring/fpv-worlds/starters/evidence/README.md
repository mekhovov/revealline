# Starter qualification, 4 October 2026

The accepted authoring run used main baseline
`a087facd9ca57f0e7519aa161cb6acc86a7eee3e` and the exact source hashes in
[`qualification.json`](qualification.json):

```sh
node authoring/fpv-worlds/starters/build.mjs --out /private/tmp/fpv-creator-starters-flights-r5 --fly
```

- Ten standalone projects retain their definitions and compiled courses through
  the same split/compile APIs used by World Studio.
- Twenty editable ZIP/world-pack round trips and twenty byte-identical rebuilt
  archives pass. The ten editable ZIPs total 144,105 bytes.
- Twenty nominal routes pass 314 swept collision segments. Airborne segments
  include 500 mm extra clearance around the unchanged 220 mm drone radius;
  takeoff and landing segments use the actual radius.
- Twenty ordinary-control flights complete, totaling 55,804 ticks with zero
  hard contacts. All twenty independently replay to the exact recorded state.

[`recordings.zip`](recordings.zip) retains the twenty original authoring proofs.
Each entry's SHA-256 and length match the receipt. The archive is 173,926 bytes,
SHA-256 `8af96430a7741e39af04a3faf22fb730393c87733fba97a02ee3564a8c9103fd`.
This compressed evidence archive is **not** an editable project or an installable
world pack. Regenerating with the command above writes individual proofs beside
the supported editable ZIPs and `.rlpack` files.

The initial r4 flight run completed and independently replayed its first route,
then failed in the qualification script: it passed scalar identity strings to
`canonicalWorldJSON`, which treats string inputs as JSON text. The corrected
comparison uses scalar equality. That failed output remains at
`/private/tmp/fpv-creator-starters-flights-r4`; its first proof is identical to the
accepted r5 proof. No route tuning occurred. The earlier r1–r3 light-check outputs
remain separate, and all accepted editable ZIPs match the retained r3 hashes.

## Actual admitted editor

The independent browser run in [`browser-r2.json`](browser-r2.json) passed
**237/237** checks. Its exact [fixture inventory](browser-r2-fixture.json) pins
the 102-member admitted player at source
`d9ad2561ee1d7685ef97961478b7de30278c1e48`; the unchanged host module SHA-256 is
`6bd30bcd11caa83ccdb36d9bb7c826a9735b5d4549bb49008494921a6a0ba4cc`.

The browser verified all ten original ZIP hashes, one-course identities,
independent mode arrays and actual admitted definition compilation. Public UI
actions imported Natural Sweeper and Industrial Split Level, moved a gate by
250 mm numerically, checked exact Undo/Redo, exported editable ZIP and playable
pack, reimported the ZIP, installed the edited pack and retained the original
exact revision. Both original mode proofs for these two projects independently
completed on the admitted engine with zero hard contacts: 2,108 and 2,081 ticks
for Natural Sweeper; 4,024 and 3,670 for Industrial Split Level.

After stage one's 206 checks, a trusted computer-use drag moved the selected
upper Industrial Split Level gate's red translation arrow from screen coordinate
`[649,289]` to `[661,296]`. The resulting course delta was `x=3500 mm, y=0, z=0`.
Stage two verified that only the selected Self-level gate changed, with the Acro
route, IDs, rules and all other course fields unchanged. It checked exact spatial
Undo/Redo, export/reimport, edited installation, retained original revision, and
online native IndexedDB reopening through the public Library **Edit** action.
The [final screenshot](browser-r2.png) records the accepted browser state.

The earlier [`browser-r1-failed.json`](browser-r1-failed.json) preserves 197
successful checks before a reopen timeout. Its fixture incorrectly called the
parent window's native IndexedDB factory from the host iframe. Native records
therefore crossed JavaScript realms and conflicted with the player's plain-JSON
prototype checks. The corrected fixture keeps the host's own native factory and
prefixes only database names. r2 confirms both readers' Object/Array prototypes,
exact persisted content, connected Edit target, delivered click and visible
Workshop after reopening. No production validation or runtime code changed.
Both frozen local fixture directories remain retained separately.

The browser receipt is 62,495 bytes, SHA-256
`71bfc3b2b7514ed5fa81c37f29db52b80b66e10bbead58d36dfc3039f598d849`.
The fixture inventory SHA-256 is
`6de8fa86aaf3bad2b396d9976413f2db2ce41af14149e48ca8b24f986ddb32b6`.
The failed receipt SHA-256 is
`0148730c9e0a12042e9fac0e2d25ea6fe34859b1788fbf8a16489ec37aa0306d`.
These raw receipts retain the original bytes; do not reformat them.

The original flight receipt's `browserQualification: pending` describes its
earlier source run; the separate r2 receipt supplies the later browser result.
Edited browser copies do not inherit the original routes' clearance or flight
qualification. Offline access, the explicit Acro spatial editor mode selector,
complete D4, physical-device, novice and performance acceptance remain open.
