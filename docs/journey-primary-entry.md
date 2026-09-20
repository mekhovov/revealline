# Journey primary entry

A fresh opening or authored Journey offers **Start · First return**. Activating it prepares and starts that mission directly, without compulsory Missions or briefing screens.

**Continue** requires an unfinished in-memory flight, an accepted saved flight, or a known Solo cursor in the current Journey catalogue. A selected cursor returns to that mission; a completed cursor uses the established successor policy. The first-mission fallback remains available to Start but is not evidence of prior play.

Unknown stored cursor identities are preserved. Versus progress alone does not change a first Solo visit to Continue. Storage denial keeps the existing session-only warning and direct Start. No profile format, picture retention, difficulty, simulation or award behavior changes.

## Regression checks

`game/test/first-journey-entry-host.test.mjs` exercises both fresh libraries, selected/completed Solo cursors, an unknown cursor, independent Versus progress and unavailable storage. Tests activate the visible primary control, assert the named destination and ensure title rendering does not grant progress. Existing title-entry and Journey host suites cover saved/memory Continue and corrupt-save handling.

Native qualification must start with a fresh origin: inspect opening and authored title actions before playing, press Enter to start, pause, use Main menu, then explicitly Continue. Do not mistake browser HUD observations for exact checkpoint verification; use host tests for state identity. Physical controller, touch-only, offline and public-release evidence remain separate gates.
