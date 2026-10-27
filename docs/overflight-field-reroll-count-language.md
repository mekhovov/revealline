# Raid Recalibrate count language

Recalibrate's accepted offer contains historical bilingual copy such as
`1 rerolls` / `1 перевиборів`. The native Raid/Marathon card now presents the
current held count with canonical EN/UK plural messages: `1 reroll` and
`1 перевибір`, alongside the zero and two forms. The same comparison appears
visibly and in the card's accessible label.

The host passes its already-held reroll count through the existing card options.
The card explicitly selects its requested locale when formatting. Core draft
generation and offer metadata do not import localization or change: accepted IDs,
ranks, RNG state, serialized bilingual copy, replay facts, choices and reroll
transactions stay intact. This is a presentation correction, not a rewrite of
serialized offer copy. Card callers that omit the count keep their original
visible/accessible copy. All preview painter commands are unchanged.

This slice starts from captured main
`a94f2a6c3dac43ebeead58036a7b890414dfff37`. It complements the separate remaining
rerolls caption correction in PR1711; it does not include or claim that caption
change. Both changes use the existing canonical localization engine.

The complete seven-file native/card/core cohort passes 109/109, with zero skips
or cancellations:

- `overflight-reroll-disclosure.test.mjs`
- `overflight-raid-presentation.test.mjs`
- `overflight-raid-refit-shield.test.mjs`
- `overflight-raid-balance.test.mjs`
- `overflight-raid-core.test.mjs`
- `overflight-raid-variants.test.mjs`
- `overflight-host.test.mjs`

New tests stage a legal native Marathon refit at counts zero, one and two. They
exercise the actual upgrade owner, card and direct native transactions, including
EN/UK/EN rebuilds, retained focus, no serialized run mutation, post-reroll held
counts, exactly one accepted choice, and default external-card/painter
compatibility. This modeled staging is not a claim of earning the refit during
browser play. The new complete disclosure file first reproduced the missing
visible comparison on unchanged production (6/7); that failed receipt is retained.
Every original assertion remains intact.

Changed-file lint and formatting, catalog message parity, canonical serialization
and whitespace checks pass. Full repository lint, uninterrupted source validation
and actual browser layout remain pending on the final candidate. No hardware,
offline/PWA or physical-rendering qualification is claimed.
