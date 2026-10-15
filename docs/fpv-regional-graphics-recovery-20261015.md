# Regional graphics preparation recovery — 15 October 2026

## Problem and correction

An installed Tropical region could verify all saved source bytes yet fail to prepare its graphics within the existing 30-second deadline. The host reported only “Area unavailable”; opening Pause lost the explanation and offered no direct way to retry with fewer graphics effects.

The host now distinguishes source loading, graphics preparation, explicit cancellation and graphics-context loss. A graphics deadline failure stays visible in the flight status and the actual Pause menu, in English or Ukrainian. “Restart with Performance graphics” saves the low-detail preference and rebuilds the selected region at its starting point, paused with zero input. It never arms the drone. Normal Retry remains available. The deadline remains 30 seconds; no source, physics, collision or resource budgets changed.

Final renderer preparation is also bounded by the same deadline. An expired callback cannot cancel a replacement host. A graphics failure does not mark a saved starting location invalid.

## Native review

Root operated the native in-app browser through CUA on isolated origin 9068. The fixture loaded production host, renderer and unchanged Tropical source; its only modeled fault was one renderer-preparation promise that did not complete. It did not alter clocks, player storage or source bytes, and did not create real GPU pressure.

- Initial source `74d0e56fcbe403b9ca1f19a13d1359da785b2bff`: the flight message was correct, but Pause did **not** retain it. Normal Retry rebuilt the real scene disarmed. This failed Pause check motivated the explicit menu-owned recovery section; a briefing summary is not a Pause status surface.
- Corrected source `b6a3668885ac8c5531caad3c0b3b22709c708bc0`: the English initial-prewarm stall and Ukrainian `fault=final` stall both reached the unchanged deadline. In both cases the explanation and Performance restart action remained in the actual Pause menu; Arm was unavailable while preparation had failed.
- Clicking Performance restart rebuilt the real scene at 16 m with zero throttle/drift, remained disarmed, and enabled Arm for an explicit later action. The visible settings DOM confirmed that the low-detail quality option was selected. No automatic flight was observed.
- The subsequent source guard `8e4d850` changes only ownership checking in the expired timeout callback. Its production-session checks and scoped static checks passed; the native UI observation above binds to `b6a3668`, not a later package.

Screenshot retained outside the repository:

| Evidence | SHA-256 |
| --- | --- |
| `graphics-recovery-b6a3668-uk-pause-20261015.png` | `94878526a3893da6a929c4be0350b37761fee83f410535dac0eb8a7e0d78f266` |

The earlier negative observation is retained as `graphics-feedback-74d0e56-pause-missing-20261015.png`; it is not used as a successful visual receipt.

## Existing functional verification

`node authoring/fpv-worlds/regions/verify-host-session.mjs` passes with the existing exact Urban paired source, both flight modes, paused launch/retry/cancellation, starting-point validation, input adapter, boundary handling and disposal. Its additional real-session graphics failure case verifies a preparation error, disarmed zero-tick state, localized classification, successful paused retry, explicit arm and disposal. Missing source, cancellation, invalid saved position and context loss remain distinct.

Scoped ESLint, JavaScript syntax and whitespace checks pass for the four changed executable files. Native preparation was a controlled stall followed by real rendering; it is not a device performance benchmark or a reproduction of the underlying graphics-driver cause.

## Limits

The original exact-package failure and later successful origin-unavailable retry remain documented separately in `fpv-tropical-package-qualification-20261015.md`. Closing completed review canvases preceded that retry, but this does not prove the underlying cause. This correction improves truthful feedback and recovery without raising deadlines or claiming universal graphics success.

No package/offline qualification of this new host revision, browser-process restart, real-device matrix, real quota eviction or final coastal art-quality acceptance is claimed here.
