# P05 Couch resize focus — internal candidate

This package starts at `2c61981b26990b8eb9641ac649300d4a32720746` (tree `a0f466b04869d2034507265dc297e3d5993b7711`). It adds one shell-local Window resize listener and a new actual-host test file. Only the currently focused eligible action may receive an immediate nearest scroll after finite geometry and final owner/foreground checks. It never focuses an action or changes the round. The [contract](../../../couch-resize-focus.md) describes its boundaries. The scoped native resize review is closed; this is not a version, release or completed phase.

## Source and automated scope

Final [held02](source/held02.json) pins shell `75aa303d7d9d12ee57e87e41fc1f9b3f2eb72840bcf3d283a504371f90392d38` and test `8d39c376319fe13acc424ee9667b19d93b8555c3c7e6c536ca8c16e29e2728d0`. Root and Dewey independently closed the source review. The complete `couch-resize-focus`, `couch-shell` and `couch-navigation` files ran on each runtime.

| Source                          | Node 22.22.2          | Node 20.19.5    | Scope                                                                                    |
| ------------------------------- | --------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| Final held02                    | 64/64; 43.405 s       | 64/64; 93.866 s | Three complete files; final 20 resize cases plus existing shell/navigation               |
| Historical held01               | 63/63; 32.008 s       | 63/63; 45.440 s | Same three files before the final-read regression and guard                              |
| Held01, targeted new regression | 0/1; expected failure | Not run         | Final style read loses foreground without moving activeElement; old source still scrolls |

The [final receipt](automated/final/verification.json) retains exact commands, log hashes and finite before/after input pins. All 526 physical inputs (11,215,837 bytes) remained unchanged through the final pair; this is not a complete import-graph or hosted-CI claim. Lint, formatting and diff checks passed. Guidance and this evidence were added afterward; runtime/test pins remain held. No unrelated whole-suite, build or archive run is inferred. Overlapping predecessor/final counts are not additive.

The [historical receipt](automated/held01/verification.json) and [before-fix diagnostic](automated/final-read-before-fix.json) preserve the original outcomes. Historical source bodies were reconstructed by reversing only the final guard/test insertion and verified against the original held01 hashes. Raw text is retained as exact bytes or gzip; [evidence.json](evidence.json) records every original and retained hash, size and encoding. No trailing-whitespace transformation is hidden.

## Native predecessor and final successor

The selected predecessor originals record actual 844×390, DPR1, Plain/Large/Ukrainian/Rich. Start remained focused at y592.265625, height50.6953125, scrollY0 after resize alone. That event had no screenshot. Its review belongs to the old seven-event native record in the [transition-focus package](../p03-couch-visible-focus/README.md); separate Results/board-return successes do not fix this resize seam.

The [fresh preview binding](preview/binding.json) uses exact base Git bytes plus one immutable held02 shell overlay. [Four actual HTTP response checks](preview/http-before.json) match their source authority. Port58902 is normal: no delayed response, game clock, state injection or mock application. The helper retains a 64 MiB Git-body LRU and four request slots; that is not a total RSS cap. The old port54539 remains independently bound. Root performed the actual keyboard/viewport actions and inspected all eight final JPGs. [Four post-native HTTP/local pins](preview/http-after.json) still match the same source authority.

[Root’s final review](native/final/root-review.json.gz) retains eleven native events and eight inspected JPGs. The normal viewport was 1924×1356/DPR2; the two controlled orientations were actual 844×390 and 390×844/DPR1. Keyboard Options selected Plain/Large/Ukrainian/Rich. Current-action observations include:

| Action and event          | Viewport             | Observed y + height     | Result                                         |
| ------------------------- | -------------------- | ----------------------- | ---------------------------------------------- |
| Same Ready Start, 02      | 844×390              | 324.76 + 49.30          | Visible after resize only                      |
| Same Ready Start, 03      | 390×844              | 548.98 + 49.30          | Visible after resize only                      |
| Plain/Large Start, 05     | 844×390              | 307.77 + 50.70          | Visible control and focus ring                 |
| Help Read controls, 06–07 | Portrait / landscape | 128.90 / 131.67 + 47.00 | Current action retained; no reading activation |
| Paused Resume, 09–10      | Portrait / landscape | 685.28 / 323.27 + 50.70 | Visible; round remains paused                  |

Root explicitly started the round, pressed S, waited about 450 ms and pressed Escape before the paused samples. Viewport reset retained paused Resume. The native record establishes displayed state and focus, not authoritative checkpoint equality or exact cut length. All eight screenshots were coherent; long menus scroll to reveal the current action rather than showing every label at once. This source-specific pass preserves the older failed observation and unresolved capture history without rewriting them.

The paused host scenario verifies started movement and checkpoint preservation; its retained test name says “started cut”, but it does not assert a nonempty active cut. The final host cases model exact scroll intent, same-root currentness, hidden/inert/disabled/background refusal, recursive/invalid geometry, terminal disposal and unchanged real live/paused/finished checkpoints. Those host cases do not prove rendered geometry, contrast, focus-ring separation or physical hardware; the scoped native samples above supply their own limited geometry and image evidence. Actual browser zoom, broader layouts, system/storage behavior, other hosts, final P03/P05/P08 composition and public acceptance remain separate. Earlier screenshot bands remain an unresolved historical capture diagnostic; no runtime defect is inferred from them.
