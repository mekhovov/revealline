# Native caught-clip bridge (P2 draft)

This cache-only implementation completes two real generic actor lifecycles: Capture relay sentinels emit `encounter.defeated`, and Team hunters emit `enemy.defeated` when their occupied trail cell is secured while they are not committed. Both continue to use their native capture transactions, scoring, result timing and prepared artwork ownership.

An already admitted animated atlas can now play its `caught` clip for at most 420 ms. The bridge borrows the currently prepared body and authoritative defeated position, holds at most four bodies per board, and reserves each body as one piece inside the existing shared destruction allocation. It adds no blast envelopes, audio, asset decoding, gameplay state or saved/replay fields. Ordinary particles retain priority; two boards still share 128 pieces and four burst envelopes.

Fixed-step event consumption is separate from painting. Multiple steps between paints do not lose a legitimate defeat. First observations, backward or forward seeking, run/source replacement, disposal and old background frames cannot replay catches. Full reward-picture reveal clears the finish without claiming budget. Pause holds its pose; Reduced effects uses the first clip frame while the bounded finish still expires. A relay clear may therefore show no caught clip if the host immediately reveals its reward picture; preserving that picture and result timing takes priority.

This does not invent defeat states for territory-retaining bouncers, replace Team stronghold secured artwork, or duplicate Hunt/Snake/native SIM soldier destruction. Generic pressure/hunter acquisition already owns a warning/anticipation phase. There is no separate native notice phase to infer. SIM Lookout's actual notice phase is already connected to its native binocular/head pose. Studio may continue exposing clips that a particular native actor never uses.

## Draft software evidence

- Seven new regressions use actual native Team capture and a legal two-stage Capture relay route, then exercise actual Team/BoardPainter atlas drawing, first-observation suppression, duplicate terminal events, pause, Reduced effects, restore/seek, source retirement, hidden stale frames, authoritative positions and two-board mixed debris capacity.
- Node22: 76/76 passed across the new file, existing atlas, Team enemy slots, renderer readability and Team presentation suites. No skipped/cancelled cases. Receipt: `.cache/p2-drafts/art/actor-defeat-scoped-final.tap`.
- Node20.19.5: 7/7 new regressions passed. Receipt: `.cache/p2-drafts/art/actor-defeat-node20.tap`.
- Six canonical-path ESLint and formatting checks passed in `.cache/p2-drafts/art/actor-defeat-static.json`.

These are draft software checks, not human animation approval, physical-device measurements or committed-source delivery. After application, include the new test in the presentation verification phase and rerun the complete relevant source-bound cohort/build. The shared helper is a new native build dependency of the Capture/Team painters. Private-room snapshot-only painters intentionally do not replay historical defeat events; no wire/event schema is changed by this local bridge.
