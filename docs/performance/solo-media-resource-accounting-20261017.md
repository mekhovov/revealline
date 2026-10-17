# Solo media owner accounting

This Phase 4 correction completes two missing fields in the existing manual performance export. It does not establish a leak, reduce an allocation, or qualify native playback or game performance.

## Reproduced gap and change

The actual soundtrack player, driven by its Node media harness and a validated original, retained one Blob URL for **4,170 compressed bytes** after preparation completed. Its export showed zero queued work, active work, and inspection bytes but omitted the retained original. Separately, the actual inspector retained one reusable idle worker after a completed inspection while exporting `workerActive: false`. These are modeled owner observations, not measurements of browser memory or native decoding.

`game/ui/soundtrack-player.mjs` now exports `playback.ownedBlobURLCount`, `ownedBlobBytes`, and the corresponding rows for each deck. Byte ownership follows the validated Blob through current/next preparation, replacement, the permitted-element transfer, and deck clearing. Remote HTTPS URLs are not counted as owned Blob URLs. Counts describe compressed source retention; they do not include decoded PCM, browser buffers, or renderer allocations and must not be treated as total process memory.

The existing swallowed `revokeObjectURL` failure behavior remains. Saturating `failedRevocationCount` and `failedRevocationBytes` record uncertainty separately after the deck releases its reference. They do not assert that the browser released or still retains those bytes. No URL history or new retry is kept.

`game/ui/mp3-inspector.mjs` now exports `workerOwned` independently of `workerActive`, request bytes, and pending requests. An idle reusable worker remains owned; the flag clears when the existing retirement path clears its worker reference. A rejected original does not incorrectly count as worker retirement. Worker transport failure, cancellation, and close retain their existing behavior.

Only the existing manual `preparationDiagnostics()` export constructs the per-deck rows. The application includes it in its manual performance export at `game/app.mjs`; ordinary frame updates do not call it. The patch does not change media phases, admission, budgets, queue selection, validation, playback, or cleanup ordering.

## Verification and retained failures

Node 22.22.2 ran the seven complete direct dependency files: `audio`, `soundtrack-player`, `soundtrack-gain-leases`, `audio-master`, `soundtrack-master`, `media-preparation`, and `mp3-inspector`. **151/151 passed**, with no failures, cancellation, or skips, in **1.399 seconds**. Scoped ESLint, formatting, and diff whitespace checks passed.

The ownership assertions compare diagnostics with the harness's actual created/revoked URLs and source Blob sizes. They cover distinct current/next originals, pause, a denied second element transferring the same URL, replacement by an unowned stream, blocked playback retaining its original, failed source installation, failed revocation, cancellation before late bytes arrive, and disposal. Inspector checks use the real static worker wrapper for successful and malformed originals and verify idle reuse, active cancellation, failed transport, safe fallback, and repeated close.

The earlier eight-file run including `soundtrack-preparation-policy` remains **154/159**, not an all-green result. An exact-before module-loader control using source `e6dceb4169945fc33b6786680c97e3aa4275f962` reproduced the same five failures in that unchanged policy file (**3/8 passed**): silent context preparation, unmuted network opt-in, local gesture preparation, and the two late local-miss status cases. Neither policy assertions nor deadlines were changed. The control substitutes only the exact previous two owner modules at their original module URLs; it does not restore or mutate tracked files. These failures remain separate unresolved evidence and do not validate those behaviors.

A subsequent bounded readback also verifies these same five failures against the retained original-main `b11745223861c3973ad4bf440cc536198b8e0371` control. Names, failure types, messages, codes and available expected/actual/operator fields match across all four observations; the test bytes are identical. This strengthens the pre-existing classification without passing the behaviors or claiming a new later-main `8b` control. No tests were rerun or historical evidence rewritten. The comparison is `.cache/solo-followup/resource-accounting-baseline-comparison/comparison.json` (4,824 bytes, SHA-256 `e26588c1c8d479ba3ecd3c2235703e6755222ec8365aca1d185ae1c114e54969`), linked to the original inventory's fully verified raw records.

Evidence is retained under `.cache/solo-followup/resource-accounting-ca59/`:

| Artifact                                                 |  Bytes | SHA-256                                                            |
| -------------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `affected-seven-complete.tap`                            | 36,293 | `de515cc1b5aeffc192275c16264627b7740164a55829cfa70f82ce54f2068f65` |
| `affected-complete.tap` (eight files, five failures)     | 41,588 | `379ccfabd61cd5f8069e8252a87438a8a30a06b459563f19e8375f2077ede2c9` |
| `preparation-policy-before.tap` (five matching failures) |  5,834 | `a26ea87b0209614487fe10311b589ea21d9765bc337c2d761506713eaccd1af1` |
| `resource-observation-after.jsonl`                       |    722 | `9f29738107ee8614d6598d07bde8a9fff8ebbe2ba78e854d634fb52a3741a944` |
| `receipt.json`                                           |  2,669 | `6391be0a6df5b67ef9673db840d4eed7c08d6a8e386b2a7af5f0d3da6abd1626` |

The unchanged observation recipe is `.cache/solo-followup/acceptance-audit-5218/resource-observation.mjs` (2,172 bytes; SHA-256 `f848e1848f5b60e558b12d5ff55c5f20703c89e363f6c040a877d22b2e0d075b`). Its retained before result is 508 bytes, SHA-256 `824965673c8441c95a814541e667a6b9fb66f4c6a197748f9a81873881edd8d3`. The same recipe after this patch reports one owned URL/4,170 bytes and the idle worker owner correctly; no native browser was used.

## Source identity and remaining qualification

| Runtime module                  | Before bytes / SHA-256                                                      | Candidate bytes / SHA-256                                                   |
| ------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `game/ui/soundtrack-player.mjs` | 58,736 / `f52ed5583f1a12f5d6a4f84560cb009884de8777c07ac23eac0e93820d793227` | 59,994 / `575de97bfd7a690b2ca9528a788d4152624e1da1c256ec67732db71e2e0ca394` |
| `game/ui/mp3-inspector.mjs`     | 4,046 / `4a3f26764e7e9e963987e485b09e168e161fb5881ac5ca716d955b6285acf22a`  | 4,084 / `55e366fab87020cf84176b6fec678e62abd5fbdbe8b44be5715d48bd19ef2533`  |

The before runtime includes the frozen `ca59e7f63` startup batch. This accounting patch creates a new runtime identity for the prospective package. Existing production packages and native observations retain their original source identities. Native memory stability, sustained timing, full numerical gates, and Steam Deck OLED/iPhone 17 Pro Safari qualification remain open.
