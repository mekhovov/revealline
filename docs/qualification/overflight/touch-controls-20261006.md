# Overflight and Snake touch controls — qualification report

## Completed

- Survivor and Raid now use the main game's shared floating-stick, swipe and D-pad preferences: steering hand, size and opacity persist across modes.
- Overflight accepts a steering thumb and an independent held Boost thumb. It supports diagonals, screen-reader and switch click activation, and does not reinterpret a held touch after pause, an upgrade, a retry, lost focus or context recovery.
- Snake now turns while the player moves their thumb, supports the three shared steering styles in Solo, Team and VS, retains its relative-turn option, and exposes the controls on hybrid touch devices.
- The shared controls use the main visual contract: 156/192 px controls, a 112 px floating indicator, correct bottom-row D-pad target, preferred-hand ordering, safe-area placement and exact selected opacity.
- Survivor, Raid and Snake retain keyboard, controller, settings, offline and lifecycle behavior. The Overflight settings view includes its shared touch presentation controls.

## Verification

- 122 focused Snake/shared-touch/Overflight-touch tests passed.
- 105 focused Overflight host, controller, core, presentation and Raid tests passed.
- Scoped ESLint, Prettier and `git diff --check` passed.
- Three generated FPV projection checks were byte-identical.
- Offline closure checks passed. Browser review confirmed the Overflight settings controls; phone review at 390 × 844 confirmed Snake's control geometry without horizontal overflow.

## Follow-up outside this change

`scripts/test-offline-destinations.mjs` currently fails its fixed 12,000-byte bootstrap-metadata ceiling: the unchanged 50-route catalogue produces 12,085 bytes. No changed file in this branch participates in that calculation. The assertion should be made proportional to the route count or adjusted alongside the catalogue expansion.
