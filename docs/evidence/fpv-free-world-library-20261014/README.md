# Optional free worlds — source-player verification

14 October 2026, local source player at `http://127.0.0.1:8998/optional-practice/fpv-worlds/index.html#packs`, Codex Chromium in-app browser on the development Mac. This is not public deployment or hardware-FPS qualification.

All 16 final `.rlpack` files were installed through the normal Library file chooser. Each named custom mission was selected through the shared mission chooser. Readiness was tied to the expected `flight-title` and enabled `world-arm` after scene preparation, not merely the previous scene's visible canvas. `browser.json` records the resulting title and active-flight status; the corresponding screenshots show every loaded map. Captured warnings/errors were empty. Browser viewport followed the app window (final screenshots 1160 × 1144); no mobile-device claim.

Browser inspection caught and corrected duplicate obstacle placeholders, coplanar procedural ground and overview fog obscuring the imported art. The new scene opt-ins keep collision active, preserve legacy scene rendering, hide represented procedural ground/scenery and omit fog only for map/editor inspection. FPV/chase retain course fog.

The independent content verification is in `authoring/fpv-worlds/free-worlds/distribution/r1/flights.json`: every course completed using ordinary flight commands in Self-level and Acro, no contacts/lost health, and matching independent replay final state. All GLBs pass Khronos validation; pack/editable round trips preserve the project and model bytes. These introductory routes do not verify every off-route opening or manoeuvre.

Existing world-content and world-runtime regression checks: 26/26 passed. Changed runtime lint and generated-worker/reaction/world-visual projection checks passed. Additional unit coverage remains deferred. Full package admission runs in the existing cloud workflow: local free space is below the unchanged stable 3 GiB floor. Protected merge, public Library installation and public deployment launch remain separate gates.

Seven Poly Haven collections are explicitly not installed/prepared; see the cohort README for sizes/format preparation requirements. This delivery is 16 prepared maps, not every free world on the Internet.
