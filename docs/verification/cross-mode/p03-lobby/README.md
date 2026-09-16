# Shared Couch mode row — scoped candidate

This internal P03 candidate adds the same ordered Solo / Versus / Team presenter to the existing Couch lobbies while retaining their checked departure owners. The current mode is non-actionable. Team moves the existing row into its active paused panel and hides it during play. See the [implementation contract](../../../common-couch-lobby.md). Source base: `1f53e829de7ec5db387ef5803b3622a10816e028` (A2/R3, without the separate R5 focus adaptation).

The [root verification](retained/verification.json), SHA-256 `5bce9739bee95cc6f863470d8055c09c50012760630618bfaa2320e0cead53e3`, pins all six runtime/CSS/HTML files and the final source, test and native scopes. The shared module is `7b7f7369966c7d56d1c74c512bff7da006d5e6b29ec9d2bc08bc0d184107b858`; the final CSS is `e731f8bac965adcec2e8fe5fe855eeb53c28a2f77529d619fedc2898ea49e7d6`. Independent source review covered the six files, the two host-test changes and the final CSS specificity correction.

## Automated boundary

Seven complete files passed **261/261 per runtime**, with zero failures, skips or cancellations: `couch-shell`, `coop-host`, `couch-navigation`, `couch-departure`, `controller-navigation`, `mode-return-host` and `couch-markup`. [Execution receipt](retained/execution.json) and [275 finite input pins](retained/execution-inputs.json) retain the actual commands and unchanged before/after inputs. All 275 also matched the working tree before this documentation package was added. This is a focused compatibility boundary, not full repository CI or a claim about an unlisted import graph.

| Runtime      | Runner duration | Measured elapsed | Original log                                 |
| ------------ | --------------: | ---------------: | -------------------------------------------- |
| Node 22.22.2 |        42.502 s |         42.601 s | [Lossless log](retained/node22-whole.log.gz) |
| Node 20.19.5 |        56.820 s |         57.169 s | [Lossless log](retained/node20-whole.log.gz) |

The changed host cases exercise non-actionable current-mode spans, fixed anchor identities and hrefs, visible DOM/Tab order, the same Team nodes moving between lobby and pause, hidden live-play links, and checked departure/Stay returning to the actual opener. Existing host files retain stronger checkpoint, controller, currentness, fault and return-hint assertions. These use real game hosts with finite browser/input boundaries; they are not physical-device tests. Root's receipt also records passing lint, formatting and whitespace checks.

The [initial log](retained/predecessors/lobby-initial-node22.log.gz) reports 74 passes and 11 failures among 85 cases because the sparse checkout lacked the committed `mode-return-v2.mjs`. The [added-input receipt](retained/predecessors/lobby-added-input.json) pins the exact 6,771-byte baseline file. The [next 13-case run](retained/predecessors/lobby-couch-input-fixed-node22.log.gz) passed 12: the old Team-first Tab expectation needed to reflect the intentional Solo-first row. The corrected two-file [86/86 run](retained/predecessors/lobby-behavior-node22.log.gz) is retained separately; its count is not added to the final 261.

## Native desktop record, 15 September 2026

Root recorded 14 actual keyboard observations at **1309×1348**, reviewed three PNGs, and bound the preview to the six final overlays over the exact base. The [final preview binding](retained/preview-final.json) is the authority for port 53720. Earlier preview configurations retain their previous CSS hashes and are not successor proof. The preview used no game/storage/input state injection or artificial response delay.

The [original events](retained/native/events.json.gz) record:

- Versus Solo → current Versus → Team DOM order; deliberate Tab skips the current span. Start hides the row, Pause restores it, and Team departure uses the existing confirmation. Stay restores that same Team anchor; a deliberate Leave reaches Team.
- Team uses the same order with a static current Team span. Start hides the row; Pause places the same links inside the active panel. Tab reaches Solo then Versus. The checked Versus departure and Stay preserve the actual opener.
- Measured cards were about **63.83px high**, with `10px 12px` padding, stretch alignment, shared text color, amber current border and cyan focused border. These observations validate the resolved desktop cascade, not every layout or contrast condition.

The untouched screenshots are [Versus lobby](retained/native/versus-lobby.png), [Team lobby](retained/native/team-lobby.png) and [Team paused modes](retained/native/team-paused-modes.png). The first Versus screenshot includes independent artwork/font loading status. Native Team used stationary 0:00 attempts; exact cut geometry is host-test evidence, not demonstrated by those screenshots. Snapshot and subsequent DOM reads are separate observations.

## Retention and limits

The [evidence map](evidence.json) records 21 exact originals, 599,319 bytes before lossless compression and 402,308 bytes retained. Gzip logs, events and helpers decompress to their original hashes; JSON and PNG bytes are copied unchanged. No text normalization, screenshot transformation, artwork duplication or large build artifact is included. Original receipt paths preserve the earlier cache layout and should be resolved through the map by hash.

This package does not certify R5 initial focus, Title three-mode entry, full lobby redesign, Team header/briefing/style parity, P05/P08 artwork, phones, zoom, touch, physical controllers, offline, public deployment or phase completion. Compose and requalify those separate owners; this work changes no version, game format, simulation or producer approval.
