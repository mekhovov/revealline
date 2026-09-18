# Actor-size recipe review

This declaration covers the bounded actor-size and Solo/Versus craft-inset
correction committed in v0.61.22 source
`307f46382a580b877a99123b3a7df7d9bc53dd40`. It does not close P08 or public
qualification. See the [rendering contract](presentation-system.md#narrow-board-actor-size).

The motion producer concatenates `authoring/motion-lab/render-character.mjs`
and `game/ui/actor-presentation.mjs`. Their current fingerprint is
`b050a157f2fcffb3c3811776ded9f477dbec46e1f237fc28d2d1461f989c5cc4`.
The Motion painter is unchanged. The actor input expands its logical base only
enough to meet the fitted CSS minimum and gives the CSS ceiling precedence at
extreme scale. Source sizes, rotor recipes, collision and finite sampling budgets
remain unchanged. The companion render-only inset keeps the illustration inside
the board while contact, trail/head, ability centres and simulation stay exact.

| Reviewed runtime body            | SHA-256                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `game/ui/actor-presentation.mjs` | `0b28a8f086b5615c071913beaed6d04bd6c2bddb672bb46af6f760c5ed797e60` |
| `game/ui/render.mjs`             | `4f19446017fb0ee9d156ae4c99b4e42b7276c030b0606a70cbc85cb33ca9e86a` |
| `game/ui/player-body-layout.mjs` | `46fe595f8fa93e9547a3b58ba5dedd33044347f23b2f017cd732ee2a0b0509aa` |

The retained seven-file cohort passed 100 tests on each of Node 20.19.5 and
22.22.2. Independent paint recording covers edges/corners, headings, bank,
compact/detailed and fallback bodies, rotor envelopes, interior placement,
minimum/maximum size, actual contact/trail geometry and unchanged checkpoints.
The prior renderer fails the new paint regression with a body crossing the top
edge. These tests model drawing and geometry; they do not prove native pixels.

The separate native preview used exact v0.61.21 plus these three pinned runtime
bodies, now byte-identical in source 307f463. Actual browser input and screenshots
showed recognizable compact/detailed craft at examined Solo/Versus top, left and
bottom-left positions, with understandable contact/cut association. Root's
scoped review is SHA-256
`c688971d7375f0e6fd0e361b6cd5b421f283a935ac2b5d62944e6221257a9b47`;
its native manifest is
`aef775ec84f27849ba31591611243a611cc9cf004299b3e60ae4e825f6d0ea4f`.
Original observations retain two stale screenshot-width captures and their
corrections; one provisional active-cut filename is actually a respawn. This
was agent-operated browser review, not a human player playtest.

The native scope does not cover every role, theme, corner, phase or bright
background, physical hardware, audio, offline behavior or fairness. Narrow
Large HUD overflow is a separate open correction. An oversized custom rig and
the documented minimum scale floor retain their existing limitations.

Regeneration preserves the complete fpv28 history and all original payloads.
The changed input first produces fpv29 with seven unreviewed motion records;
the exact declaration then appends fpv30. Team's two strict picture consumers
must name fpv30 while retaining their exact pack, level and picture identities.
Do not wildcard that revision or bypass stale-revision rejection. Reproduce the
producer, check the working ledger declaration, and requalify the final commit;
the committed-ledger readiness gate intentionally refuses an unstaged replacement.

The [production-correction evidence](verification/cross-mode/actor-readability-v06122/production-correction/README.md)
retains the original hosted failures, append/reproduction checks, focused red and
green cohorts, and peer/native reference records. Those local checks do not
replace committed-source qualification or native public acceptance.
