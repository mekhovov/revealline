# Published Solo device checks

Availability update, 18 October 2026: the user confirmed neither target device is currently available. Physical qualification remains open; continue automated work independently.

This checklist collects the physical-device evidence that desktop Chromium and WebKit cannot supply. It does not replace the automated timing, replay, raster or resource gates in the [current plan](solo-performance-followup-plan.md).

## Build and device record

The first published performance revision was `56e29fd264f77df191b75b3425cc6e7bb0ce9e13`. The latest independent HTTPS readback in this review is `4f68b924ee74c1a02fa340b1d17ddadf5ffa2c3f`, deployment `main-4f68b924ee74`, game version `0.151.1`; runtime repair PR #1579 is still awaiting publication. Record the actual revision before and after the session using [published build metadata](https://mekhovov.github.io/revealline/game/build-info.json). If it changes, separate the observations by revision. A version label alone is insufficient because the rolling main channel can publish different sources with the same game version.

Use the ordinary [published HTTPS game](https://mekhovov.github.io/revealline/game/), with the existing saved profile and library. Do not clear site data or reset progress for this check. An installed/offline copy is a separate condition; use its existing update flow and record that condition rather than silently treating it as the network build.

Record once per device:

| Field                  | iPhone                                               | Steam Deck                                                   |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| Hardware               | iPhone 17 Pro                                        | Steam Deck OLED                                              |
| OS and browser version | Actual iOS and Safari versions                       | Actual SteamOS and Chrome versions                           |
| Display and power      | Orientation, Low Power Mode, battery/charger         | Configured display rate, power/frame limits, battery/charger |
| Starting conditions    | Cool or already warm; other active audio/apps        | Cool or already warm; Desktop/Gaming Mode; other active work |
| Game settings          | Effects preference, sound/music/speech, touch scheme | Effects preference, sound/music/speech, controller mapping   |
| Saved content          | Approximate library size and installed media         | Approximate library size and installed media                 |

Keep the same settings within a comparison. Record browser scheduling cadence separately from the panel's configured refresh rate; they are not interchangeable.

## Short check first

1. Open the game in a new ordinary tab. Record launch time and any visible loading stage that appears stuck. Start Solo directly without first opening Missions. Note whether the board is already ready when play begins.
2. Play the first 30 seconds, then continue for at least two minutes. Turn repeatedly, make a long cut and capture a substantial area. Record any hesitation, sudden slowdown or automatic pause, including the mission and the action immediately before it.
3. Pause and resume. Return Home and open the same mission again for a warm attempt. Keep cold and warm observations separate. Repeat each condition three times, retaining failed attempts.
4. On safe ground during active play, switch apps for ten seconds, then return and verify the automatic pause and explicit Resume boundary. Separately repeat from an already paused flight and check that it stays paused. On iPhone, also rotate in both directions; on Deck, switch focus and disconnect/reconnect the controller while paused. Record lost controls, unexpected movement or a changed flight.
5. Enable the intended music and recorded-speech settings through their normal controls. Observe a music transition and an actual speech cue if available. While paused, briefly lock/unlock the iPhone or switch apps, then use explicit Resume and check that effects, speech and streamed music recover without changing the mute preference. Record any naturally occurring audio interruption separately. Distinguish audible playback from a visible title or an API event.

An accidental death, unavailable mission, canceled load or wrong build stays recorded. It is not a successful replacement attempt. This short check is a smoke check, not completion of all performance gates.

## Full device session

On each device, keep one identified build and record a 30-minute lifecycle session, including actual active-play time, pauses, loading and menus. Include long cuts/captures, earned erosion, combat/projectile activity and a jammer warning/active phase using available missions. Complete ten actual Next transitions and twenty actual retries, recording counts and any interrupted attempts. Do not replace these actions with repeated page reloads.

Record when the device becomes warm, any power-state change, and every noticeable hitch or automatic pause. Repeat background/foreground and orientation/focus recovery later in the session. Verify saved-flight reopening separately. No deliberate GPU crash, browser security change, forced cooling or hidden game-state edit is required.

For matched numerical comparisons, use the separately declared baseline/candidate workloads and retained application reports. A manual “felt smooth” observation is valuable device feedback but does not establish p95, missed-opportunity, input-latency or memory-plateau limits. If a comparable baseline is unavailable on the device, record candidate-only scope explicitly.

## Diagnostic run when needed

First retain the ordinary-play observation. A separate run with `performance=1` enables the game's existing bounded local diagnostics. It does not upload anything automatically. Pause Solo and any Demo before an engineer reads `RevealLineSoloPerformance.export()` through the browser inspector. Preserve the complete exported JSON, exact source, actions and failures. Do not export repeatedly during active play or mix inspector traces/screenshots with the low-overhead timing cohort.

Safari's inspector can separately explain canvas dimensions/memory; Chrome's paint and selector instrumentation can materially affect timing. CPU throttling does not reproduce mobile memory, GPU or thermal behavior. [WebKit canvas tools](https://webkit.org/blog/8452/canvas-debugging/), [Chrome recording overhead](https://developer.chrome.com/docs/devtools/performance/overview), [desktop calibration limits](https://developer.chrome.com/blog/devtools-grounded-real-world).

Safari can expose an `interrupted` audio-context state after backgrounding or locking. The existing audio owner attempts context Resume for this state and retains mute/disposal guards; this source inspection is not a device recovery result. Do not recreate audio contexts or add polling solely from older browser bug reports. [Audio interruption behavior](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state#resuming_interrupted_play_states_in_ios_safari).

## Result template

```text
Device / OS / browser:
Source revision before / after:
Display / orientation / power / charger:
Effects / audio / input settings:
Saved library / installed or ordinary browser:
Cold starts (all three):
Warm starts (all three):
First 30 seconds and long cut/capture:
Hitch time, mission, preceding action and automatic pause:
Background / rotation / controller recovery:
Audible music transition / recorded speech:
Next count / retry count:
Session duration / active-play duration / thermal changes:
Saved-flight reopening:
Diagnostic export or separate trace, if collected:
Failures, cancellations, unavailable cases and scope limits:
```

Both devices remain **unobserved** until actual results are supplied. Do not fill this template from desktop emulation or the published smoke check.
