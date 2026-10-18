# Source73 first-eight replay portability audit

Evidence/source analysis, 2026-10-18. No tests or native reruns. Four Node mismatches remain unresolved, without demonstrated same-engine browser save failure or portability qualification.

## Exact retained inputs

Run39105055762, job117608986487, artifact12127359946. Local ZIP: `.cache/solo-followup/runtime73-first-eight-39105055762/artifact.zip`, 815628 bytes, SHA256 `17665afe978ae63cfaf8d24b1a9626e1d7f607b7ee2611fc637c9e680f3d46d8` (reread during audit). All member paths below share prefix `solo-linux-73a345-correctness/evidence/`. Each recording is `<row>/report.json.replay.json`; each raw report is `<row>/report.json`.

| Row                        | Recording bytes / SHA256                                                  | Report bytes / SHA256                                                       |
| -------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| baseline-first30-chromium  | 9145 / `a03cad5a63538d1813b22ff24dc9d7e83473eefd229c176b73b864b6b4a5e81e` | 308878 / `46d5f4ff67c35229e3792e70da7c6e6d5f0fb846d9daf00eaab91693b903f5eb` |
| baseline-first30-webkit    | 9144 / `963201816cdf22780f5964558cd0eec9d5f181534ccf25352d68df0742458f81` | 223422 / `f9367c50923cee328872cdfdc9f285aafaa9a0bad2308d84547fc4602d696bb7` |
| candidate-first30-chromium | 9024 / `4dd5afe8525eab8d1caf0ac81245cb185e0e6ba41f1c158ba14e0071ad77d718` | 648609 / `4af677cc73cd51a3a35759feae6d471c67ad3b5259e812d64180e48974551959` |
| candidate-first30-webkit   | 9024 / `8d8617720a3e851003d3492fbba0ac2e71b41bab28b68037563d24985ffd349a` | 512404 / `f5b27143afeb46b6ef0fec17a3794bcf711abe66a92575f8dcb9468f790067ba` |

Candidate source `73a345cec696d7789198cf295ca5c37b17ca0e71`, tree `ea30e68636b3342f8e60664a79d425e11e27ff1e`; baseline `8b01991942dc764b8aa4726851699ce1985e53ae`, tree `9373b6a74aea8fa1ef47aa17ace140b4cf714609`. Executed Node checkout `570ca4ffe57f75c342e2d99b62a04a8b62b740a0`, Node22.13.1. Native engines: Chromium151.0.7922.34 and WebKit26.5.

## Concrete mismatches

Raw location: `replay.nodePortability.observation.diagnostics`. All four summaries and tick totals match exactly. Other checkpoint sections match.

| Row                | Tick | Differing sections       | Recorded enemies hash -> Node hash       |
| ------------------ | ---: | ------------------------ | ---------------------------------------- |
| baseline Chromium  | 3453 | enemies                  | `41794174193d235e` -> `430ef45c304f9c1d` |
| baseline WebKit    | 3472 | player, enemies, classic | `1d401070a8c16c58` -> `b2d85509468e39c2` |
| candidate Chromium | 3617 | player, enemies          | `55289e5ed68f04e2` -> `d6e4e49ee48e6b84` |
| candidate WebKit   | 3641 | enemies, classic         | `447dd1f9ce4b4cd6` -> `cd93c8b373c01d97` |

Every `replay.nativeVerification` passes in a fresh same-engine/version browser against the unchanged recording and observed production modules, including the complete strict checkpoint and requested mechanics. This is stronger than summary-only equality, but does not test browser-to-browser transfer, future browser versions, or the full storage UI.

## Actual module comparison

For each row, compared all51 retained `nativeVerification.modules[].sha256` values with SHA256 of the corresponding `git show 570ca4f:<game path>` bytes, stripping only the URL prefix/query. Candidate:50/51 match, including replay and every observed core module. The sole exception is `game/ui/combat-view.mjs`: artifact15205 bytes/`1a829a62c65c8d3a73867ddb88a045d19643c51c7a6aa7365796daf85f48380d`; checkout19793/`7319991072bfc5a9afe05bd12fa7fd9af210afd6927251c8d1e69b4229f7f2e1`. The inspector calls strict `verifyReplay` and returns immediately on mismatch before calling combatView (`scripts/solo-qualification-replay-core.mjs:24`). Thus differing simulation/replay implementation does not explain the candidate mismatch.

Baseline:45/51 match. Differences are `game/i18n/{bootstrap,catalogs}.mjs`, `game/replay.mjs`, and `game/ui/{analog-signal,combat-view,jammer-picture}.mjs`. Do not equate baseline Node reconstruction with exact-artifact source solely from its engine label. All observed baseline core modules match the Node checkout.

Executed `qualify-solo-runtime.mjs:2033-2068` deliberately records current-checkout Node portability separately from exact-artifact native verification. The latter's strict result remains the correctness authority; Node failure is retained, not suppressed.

## Save risk and evidence limits

`game/sessions.mjs:367-376` awaits strict verifyReplayAsync and throws before adoption when `checked.match` is false, leaving the current game unchanged. This file is byte-identical between source73 and audit HEAD5f196815af6b7eedf31f4255965c424f6b608dff (SHA256 `859dbafbd4ff2f94955f4062d1a773e0052fa388fc2f85a53d18c3c32d8eff7d`). Same-engine native replay passes support reconstruction stability for these records; cross-environment restoration could still refuse a recording and remains unqualified.

Only final section hashes are retained, not authoritative scalar projections or intermediate checkpoints. First divergent tick, coordinate and magnitude cannot be recovered from these hashes. The tick column is the final observation, not the first divergence. `field-course.mjs` contains trigonometric collision-course updates, but their presence does not establish floating-point variation as the cause. No tolerance, checkpoint exemption or runtime fix is justified yet.

## Smallest next diagnostic

Reuse the two existing9024-byte candidate recordings and exact artifact dependencies under Node22, Chromium151 and WebKit26.5. After measurement, reconstruct at most3641 fixed ticks and compare bounded player/enemies/classic projections, stopping at the first unequal scalar and retaining the preceding equal state/tick plus engine/module identities. Include cross-browser reconstruction to distinguish Node-only portability from browser transfer risk. Use existing production createRun/stepRun/releaseInputs and strict verifier; no live-game scenario rerun, timing claim, new observer framework, altered inputs or weakened checkpoint rule. Keep any diagnostic separate from the completed first-eight outcome.
