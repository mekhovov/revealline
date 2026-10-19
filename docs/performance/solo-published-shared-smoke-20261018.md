# Published shared-mode smoke — 18 October 2026

This is a public-interface functional observation against the repaired Pages
publication `bbd56e6fcd8f20113ccb168660d5e05d0781e1e3`, version 0.151.1.
The [publication record](solo-repaired-pages-20261018.md) retains the exact
deployment inventory and the earlier, unexplained first-launch module-fetch
failure. This later successful observation does not erase that failure.

The in-app desktop browser used a new task-owned tab and the existing browser
profile. No cache, storage, progress, browser security or sound preferences were
reset. Consequently this is not a cold-cache or fresh-profile run. The UI
reported Sound off throughout. The viewport screenshots are 1422 × 800.

Observed through visible controls:

1. Opened the published game. Home reached Continue and Select Mission without
   the earlier module-fetch error in this visit.
2. Select Mission showed Preparing missions, then the Solo library with 240
   missions. Searching `Two bays` returned the corresponding single mission.
   Back to menu returned to Home without starting that mission.
3. The Team link reached its Home. Start together opened Twin Landings with two
   reserves and 0% territory. Pause displayed the two-player pause menu at
   0:03. A click on the background Back to Solo link while the overlay was open
   did not navigate; the visible Home button opened the expected discard
   dialog. Discard and leave closed only this newly created test attempt and
   returned to Solo Home.
4. The Duel link reached its Home. Start race displayed both player boards,
   each at 0% with three lives. Pause and explicit Resume worked. The retained
   screenshot shows both actors, concealed board interiors and background
   artwork at the borders. Pause → Home opened Return to Solo; its explicit
   discard link closed only this test attempt and returned to Solo Home with
   Continue still present.
5. The final Solo document's captured warning/error console list was empty.
   This final read is not a complete network or cross-navigation console log.
   The task-owned tab was closed. User-owned tabs were not changed.

Retained screenshots are under
`.cache/solo-followup/regression-ci-73/`:

- `published-bbd-team-paused.png`
- `published-bbd-duel.png`
- `published-bbd-shared-return.png`

This observation does not establish strict replay equality, actual controller
input, capture correctness, pixel-level comparison, a memory plateau, native
audio, measured loading duration or sustained performance. Those remain in the
[prioritized qualification plan](solo-performance-followup-plan.md). No
application defect was reproduced in these specific visible flows.
