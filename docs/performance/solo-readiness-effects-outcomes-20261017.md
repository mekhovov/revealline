# Native Resume and public effects outcomes, 17 October 2026

The combined diagnostic established warm and saved Resume correctness in Chromium. WebKit did not complete either Resume protocol, and none of its four Full/Reduced Effects arms reached gameplay. **The effects comparison is unobserved; these results do not justify changing the quality policy or claiming a performance improvement.**

## Exact execution and scope

[Run 39028705878](https://github.com/mekhovov/revealline/actions/runs/39028705878) executed tooling `c696af41857840359ae473558b90682f3d71f2db` against the successful 112-file package from source `4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7`, tree `e87e64d0e14584c2a569d06bae8e7c602c5ed105`, producer 39024034432, artifact 12098972901. Both hosted jobs finished with failure; their original statuses remain unchanged.

The two Chromium observations used browser 151.0.7922.34. The six Linux WebKit observations used version 26.5 and the declared 400 × 850 viewport, scale factor 3. This is desktop WebKit automation, not physical iPhone Safari. Each row used a fresh owned persistent profile. Full archive, manifest, source and CSP verification passed before native execution. All eight row commands closed without forced cleanup, surviving or ambiguous processes, or an ownership violation. These closures do not clear unrelated historical ownership failures.

## All eight outcomes

| Engine / row          | Observed result                                                                                                                                                                                                                | Original numerical / terminal result                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Chromium warm Resume  | Readiness and strict source-native replay passed. Neutral Resume advanced 53 ticks in 484.7 ms; no new discrete command.                                                                                                       | Short correctness window: inconclusive; row remains inconclusive.                     |
| Chromium saved Resume | Reloaded paused checkpoint and public Continue/Resume passed; strict replay passed. Neutral Resume advanced 51 ticks in 487.8 ms.                                                                                              | Short correctness window: inconclusive; row remains inconclusive.                     |
| WebKit warm Resume    | Initial running acknowledgment was followed by a visible, focused automatic pause with a retained 298 ms interruption. The subsequent Pause-button action timed out because that button was hidden. Resume was never observed. | Failed; no performance qualification.                                                 |
| WebKit saved Resume   | Initial play, pause/export, reload and paused Continue completed. The route then failed the no-open-dialog readiness expectation before explicit Resume.                                                                       | Failed; the retained partial run replay passes, but this does not prove saved Resume. |
| WebKit pair 1 Full    | Public preference was observed as Full; the Settings dialog intercepted Start. Zero active tier samples.                                                                                                                       | Failed / invalid evidence.                                                            |
| WebKit pair 1 Reduced | Public preference was observed as Reduced; the Settings dialog intercepted Start. Zero active tier samples.                                                                                                                    | Failed / invalid evidence.                                                            |
| WebKit pair 2 Reduced | Public preference was observed as Reduced; the Settings dialog intercepted Start. Zero active tier samples.                                                                                                                    | Failed / invalid evidence.                                                            |
| WebKit pair 2 Full    | Public preference was observed as Full; the Settings dialog intercepted Start. Zero active tier samples.                                                                                                                       | Failed / invalid evidence.                                                            |

The Chromium journals retain both preparation and active intervals: warm Resume has one document, 112 records and 2,688 bytes; saved Resume has two documents, 219 records and 5,256 bytes. Non-active preparation interruptions up to 633.3 ms in callbacks and 639 ms in native task observations were not discarded. These short successful correctness windows do not qualify ordinary 30-second or sustained performance.

The WebKit warm journal separates the triggering callback gap (19,570–19,868 ms, 298 ms) from the following application work (19,869–20,090 ms, 221 ms). The internal pause was already recorded at 19,869 ms; the public running label changed later. The 221 ms post-pause work cannot explain the earlier 298 ms gap. Its cause remains unobserved.

## Concrete menu-route finding

All four WebKit effects arms completed the public checkbox action and retained the requested `data-effects` value. The first Settings close action also completed, but Start later timed out after 60 seconds. Its native actionability log identifies `dialog#settings-dialog[open][data-settings-view="categories"]` intercepting pointer events. Merely observing Home's featured button had not established that the overlaid Settings dialog was closed.

The exact candidate's `game/ui/settings-panels.mjs` deliberately makes the first Back/close action from a compact Settings section return to its categories. At widths at or below 700 pixels, its capture listener prevents the ordinary dialog-close handler for that first action. This explains the observed categories dialog at the declared 400-pixel viewport. The next prospective route must observe the compact category boundary and use the normal public close control to close Settings before attempting Start. Increasing an action timeout cannot correct this sequence. The earlier modeled wide-screen route did not establish native compact-dialog behavior.

The saved-Resume failure establishes an unsatisfied no-open-dialog predicate after the replay/workshop/Settings return route. Its current raw failure does not identify the remaining dialog as precisely as the four effects actionability logs; it must be diagnosed separately rather than assigned the same cause without evidence.

All four effects rows remain in briefing, with zero active submitted-tier samples and an incomplete comparison containing no admitted arms. Their muted preparation snapshots retain volume 0.8, system Reduced Motion false and zero observed audio start/play operations. A requested preference or paused policy snapshot is not a submitted gameplay tier; no Full-versus-Reduced timing or raster conclusion is available. The numerical gates and stable-browser-30-Hz protection remain unchanged.

## Retention and readback

The local evidence root is `.cache/solo-followup/readiness-4bf-observations/`. No full candidate package was downloaded locally. Authenticated API identity, redirect-safe bounded download, outer length/SHA, full ZIP CRC and every retained member's bytes/SHA/readback were checked:

| Engine   | Artifact    | ZIP bytes / SHA-256                                                          | Members / expanded bytes |
| -------- | ----------- | ---------------------------------------------------------------------------- | ------------------------ |
| Chromium | 12099318466 | 375,879 / `e14111a8e15f0d4c717a37d4f959302697b7dac3188067d0541044e8b6f3d504` | 38 / 1,973,362           |
| WebKit   | 12099936619 | 455,438 / `ccefb4487aa8e753bb275c3f54bd142fbd5543a8f1065dbef49d9ddaf6a2225a` | 53 / 3,445,874           |

Independent exact-reader reassessment preserves the original reports and relocates only retained binary-sidecar paths in memory. `chromium-terminal-analysis.json` is 258,649 bytes, SHA-256 `3a9683e8afaec3106e92efb8b7410ce85e8cdaa07de132d59d1b2049171a370c`; `webkit-terminal-analysis.json` is 958,084 bytes, SHA-256 `54600b19f3a78dabd82dcff644359775caf6e22e555a1b841f26f490f4a948dc`. These inventories bind every raw report, replay, journal and source/admission receipt. Partial observations and every failed row remain retained; no retry, gate waiver, physical qualification or newer-source promotion is implied.
