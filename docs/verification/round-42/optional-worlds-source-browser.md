# Optional worlds source browser observations

Source: `feat/original-art-library`, optional install UI commit `2a51beeb0d283b4f7dd6fb39704afe524392e307`; later candidate changes are documentation/version only. Source server: `http://127.0.0.1:8915/game/`. These observations are separate from frozen/public release qualification.

- Installed Ukraine Atlas through the actual More worlds panel, then explicitly chose the chapter and started. Keyboard Down produced an ordinary **51.5% / 12,060 / three lives** first capture; closure stopped movement and continued simulation remained healthy. The original Carpathian picture was visible only in claimed areas with opaque black concealment elsewhere.
- Paused at **2:34**, installed the Retro chapter and returned without changing the existing flight. Reload and Continue retained that exact paused state.
- A settled **390×844** source viewport before the compact sticky-Back refinement showed no horizontal overflow and **332×54** action buttons. An earlier screenshot immediately after resize retained the previous compositor size; it was not treated as the settled layout.
- After the sticky-Back refinement, the top Back action was reached with the keyboard and Enter returned to the native main menu. Actual DOM dimensions were **1280×720**. Subsequent portrait override calls did not change those dimensions; the final screenshots are desktop observations, not a new portrait pass. Temporary overrides were reset.
- Browser warning/error log was empty after the final menu return.

Raw coordinating evidence remains under `.cache/round42/worlds-browser/`, including the original partial-reveal and settled phone screenshots, saved-state snapshots and `top-back-return.txt`. The two files named `phone-sticky-back*.png` actually show desktop dimensions and must not be cited as phone evidence. No synthetic game win, internal state mutation or browser storage injection was used.

Modeled host tests separately exercise keyboard/controller routing, cancelled refresh/download, exact saved-slot preservation and valid same-ID/different-art conflicts. Physical touch/controllers, final portrait refinement, stopped-server installed-world continuation and public browser checks remain separate gates.
