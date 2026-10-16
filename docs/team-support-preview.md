# Team Support review scenes

Asset Studio now exposes **Field context → Couch Team → Support pulse** for both First Connection and Relay Yard. Select a compatible shared actor such as `enemy.bouncer`. Both previews use actual Support input on the authored Standard/seed17 command traces, at ticks211 and291 respectively. Each initially shows two active pulses and two slowed hunters. No manufactured simulation state, new attack or altered rule is involved.

**Paused** and **Reduced effects** retain the selected specimen. **Play preview** advances the real effect timers: pulses expire while the slower enemies remain affected longer. Returning to Paused rebuilds the selected scene. Counts describe the currently painted state. Support is a nearby team assist; it is not the Solo Scan ability. Default pulse and slowdown treatments use registered recipes; image decorations are editable through [Team Support authoring](team-support-authoring.md). Production-art approval remains separate.

The scene selector and fixture now share one availability function. This fixes a duplicate allowlist discovered during browser verification, which initially disabled Support in First Connection. Existing unavailable arena-specific scenes remain disabled.

Three complete test files pass43/43 on Node20 and Node22. Tests independently replay the public commands, preserve all earlier state-hash assertions, check actual expiration/reset and compare selectable scenes with available fixtures. Browser checks cover both arenas, reduced effects, live pulse expiration, paused reset and empty warning/error console. These are bounded authoring checks, not physical-input, full-game, production-art or public-release acceptance.
