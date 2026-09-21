# C2: optional robots in the actual game hosts

2026-09-21. Base `595fdadddf3cf5c4240c430b78d27772915df83d`.
This is a technically reviewed successor, **not a deployed release or human
playability approval**. See the [whole-plan status](journey-completion-2026-09-21.md)
and [integration specification](../superpowers/specs/2026-09-21-combat-live-host-integration.md).

## Delivered

- Explicit `?journey=combat-study` Solo and paired-board Versus routes: three
  authored scout/sentry studies. Existing Rover pictures are honestly labelled
  reused test scenery; no final bespoke artwork claim.
- The normal BoardPainter, captions and bounded synthetic sound effects show
  removable scouts, locked-aim sentries, shots and cosmetic scrap. Ordinary
  keepers still retain regions; robots never do. No graphic human violence.
- Authored/On/Off gameplay editions are separately compiled and immutable.
  Settings apply to fresh attempts, not a restored flight, ordinary recovery or
  an unfinished first-to-two series. Cosmetic scrap does not change gameplay.
- Strict versioned preferences, session-only failure reporting, retry/export,
  cross-tab reconciliation and stale asynchronous preparation cancellation.
- Replay, Solo and Versus fail closed on malformed combat presentation: no
  invisible projectile continues stepping while controls are left unusable.
- Studio's actual Inspect → Apply → Play exact Solo preview workflow supports
  authored robots through normal scenario validation. Team remains unsupported.
- Additive runtime/compiler prerequisites include relay connectors, directional
  fields, timed bonuses and pressure-v2 catalogues; historical editions are not
  reinterpreted. This does not enroll every prior candidate campaign.

## Automated gates

Final targeted command, on Node 20.19.5 and Node 22.22.2:

```sh
node --test game/test/combat-*.test.mjs game/test/content-combat*.test.mjs \
  game/test/studio-combat*.test.mjs game/test/directional-*.test.mjs \
  game/test/relay-*.test.mjs game/test/sentinel-core.test.mjs \
  game/test/timed-bonuses.test.mjs game/test/audio.test.mjs \
  game/test/classic-transport.test.mjs game/test/replay-theater-display-host.test.mjs
```

296 tests passed, zero failures on each runtime. Local logs:
`.cache/c2-final20.tap`, `.cache/c2-final22.tap`.
The subsequent HTML-only accessible-name correction and formatting passed the
focused Versus/replay host suites: 10 tests on each runtime. All changed JavaScript
passes ESLint and Prettier; the final diff passes whitespace checks.

Additional Node 22 legacy host cohort: 51 passed, zero failures, covering candidate
Solo, legacy saves, difficulty, restart navigation, defeat presentation and replay
display ownership (`.cache/c2-legacy22.tap`). Node 20 route/title/replay-navigation
cohort: 52 passed (`.cache/c2-route-regression.tap`). These counts overlap other
runs; they are not added into a misleading unique-test total.

Independent reviewers examined runtime/renderer, Solo restore/preparation/replay,
Versus series ownership and actual Studio bindings. Review corrections include:

1. Continue's simulation was On while subsequent saves could be labelled Off.
   Exact restored entry ownership now survives a second save/reload and automatic
   life-exhaustion recovery; actual host tests cover that chain.
2. Reentrant cross-edition cancellation could retire a newer preparation.
   Generation ownership now fences cancellation, late decode and lease transfer.
3. Combat preference changes could affect unrelated route preparation/retry.
   Gameplay revision checks and recovery semantics are scoped to this test route.
4. Pressure-v2 missions displayed v1 difficulty descriptions; descriptions now use
   the source's actual catalogue.
5. Replay theme/inactivity updates could hide a fatal renderer diagnostic; the
   quarantine remains visible until restart or a new recording.
6. Disabled robot cards obscured unrelated mastery advice; only actual authored
   robot missions receive a qualified note, preserving other route/objective text.
7. Robot controls were in an old hidden panel. They now appear in actual
   Settings → Controls without displacing keyboard/touch/controller controls.

## Native browser observations

Actual UI operations on the isolated local working source at port 8832; no injected
runtime state. The read-only development server obtains missing media from exact
accepted-base Git blobs. This is not immutable-build or public Pages evidence.

- Solo Workshop sweep: visible scouts and ordinary keepers; legal first closure
  yielded 0.6%, score 130. Choosing Off did not replace the saved On flight.
  Continue retained it; deliberate Restart reset progress and removed robots.
- Solo Sentry detour: normal two-action Skip, visible sentry, legal partial
  closures reached 3.3%, score 740 with three lives. A second pause/save/reload/
  Continue retained that progress with Off pending. Idle inspection time is not
  a duration or difficulty measurement.
- Versus: native Off launch showed two equal boards without scouts. Paused
  Settings correctly reported current Off / next On. Two-action Skip started
  Sentry detour directly, showing matching sentries and keepers on both boards.
  Both boards were left paused. First-to-two pinning is automated evidence, not
  a completed native two-person match.
- Studio: Inspect optional robot greyboxes → Apply → Play exact Solo preview →
  Start showed the actual bracketed scouts in the practice iframe despite the
  player's pending Off preference. Closing preview returned to the draft.
- Combat preference accessible names are kept separate from their live edition
  descriptions; a native locator check exposed the previously combined label.

No native full clear, actual two-controller session, sustained projectile evasion,
mobile-device qualification, sound listening or human enjoyment claim is made.

## Release and remaining gates

The release owner must integrate this successor while preserving newer layout,
input ownership and music-credit work, rerun integrated gates, create the reviewed
PR/version/release and verify Pages. This lane changes no version, publisher or
accepted music ledger revision 50. Human balance, final art, Team combat semantics,
whole-library enrollment and final Journey acceptance remain open. Original AI
soundtrack generation stays paused.

One earlier aggregate run hit shared-volume ENOSPC while writing its log; the
failure was retained rather than counted as a test pass. Final runs above completed.
No bulk media build/download was used to finish these gates.
