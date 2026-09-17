# Shared Settings and quick Sound candidate

P03/P05 feature, candidate v0.60.6. Not a public release or complete phase acceptance. See the [current execution plan](../../../whole-game-ux-plan.md) and [bounded local evidence](local-evidence.json).

## Delivered source behavior

Solo, Versus and Team share one category helper and Settings styling. Appearance is the initial category; each visit retains the selected category. In Team a native Settings dialog replaces the old inline Options disclosure. Existing controls and preference authorities remain; closing preserves the paused attempt and returns to its actual opener. Controller and keyboard routing yield category keys once. The new quick Sound buttons use the existing master authority and agree on label/pressed semantics. The old Workshop Music shortcut is correctly labelled Sound.

Persisted restoration reconciles validated current menu/audio storage while preserving failed-save/session-only intent. Late output activation cannot undo mute. No new save key, campaign identity, picture-selection rule, simulation behavior or complete theme is introduced. Master Sound does not invent a Team soundtrack; Team retains its permanent visual-feedback explanation.

## Review, corrections and checks

- Independent reviews covered the helper, import packaging, Team dialog lifecycle and preferences. A helper hook that hides/disables its target now cannot select it. Recursive catalogue packaging is exercised by importing copied modules outside the source tree.
- Initial host tests exposed Team Escape reaching the flight listener; native dialog Escape is now isolated while the document editor retains first refusal. The finite-DOM fixtures model native dialog focus/Tab without inventing application focus restoration.
- Final review found Team quick Sound outside the paused controller root. The same button now moves with the lobby/pause tools. Strengthened keyboard and modeled-controller checks fail before the move and pass after. Native keyboard Tab → Sound → Return muted the real paused Team page while retaining its 0:00 HUD and pause state.
- Existing tests entering controls in the previous flat Options layout were updated to enter their real category. Their paused checkpoint, audio transport, controller and storage assertions remain.
- Browser review found the short-landscape focus ring reaching the viewport edge. An 8px scroll margin now leaves space for it. Versus Back is beside the Settings heading. The native selected-tab top was measured as 8px after correction.
- Final local Node 20 cohort: **279/279**, 16 complete affected files, no skips/cancellations. This is not the full repository test suite. Complete source lint, game/site/script formatting, native formatting, content validation and Motion syntax passed locally.
- Native browser: Solo title Sound/Settings/category/return; shared appearance via Team and cold Back to Solo; Versus start/pause/Settings/Back; explicit discard before switching modes; Team start/pause/Settings/Back; 390×844, 844×390 and 1280×800 geometry. No screenshots alone are used as proof of input or simulation identity.

Full exact-source CI, ordinary build/production readiness, immutable snapshot, Pages deployment and public play remain required. Physical devices, actual controller hardware, meaningful zoom, native BFCache admission, artwork parity and full phase acceptance are explicitly unverified here. Motion v0.60.5 is qualifying in the separate release owner; do not publish this source over it.
