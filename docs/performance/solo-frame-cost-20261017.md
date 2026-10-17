# Recurring Solo frame work — 17 October

The separate [CPU diagnostic](https://github.com/mekhovov/revealline/actions/runs/38995660708) completed successfully against candidate `3adcd53792043ef02459e86168c6b33a66d6ef00`, with tooling `1ccf8368a3dcd099e1608c8a9433e6f0c0518e8f`. The public cold-Start route and strict native replay pass. This source predates the dialog and late-presentation fixes. Its fixed 2.46 CPU factor is diagnostic, not a fresh calibration or performance pass.

Artifact `12086578536` is 516,624 bytes, SHA-256 `a2af2c760490376793492da9a000e5c729fb05072ada8c7a6ba5c6777e358769`. All 35 members passed full readback. The 1,750,197-byte profile has SHA-256 `95b58c3ec95a5ba02871391b3d797cdce8c4f857093ea243dd9319d90adaf395`, with 44,342 samples and 6,586 nodes over approximately 52 seconds. Exact reports and derived analysis are retained in `.cache/solo-followup/remote-cpu-38995660708/`.

The steering interval is approximately aligned from the recorder's wall timestamps to the profile clock, excluding Start and Pause. Sample counts and weighted durations identify candidates for investigation; they are not independently measured CPU time. Nested totals overlap and must not be added. Browser/GPU work, worker execution and native decoding are not fully attributed.

| Frame path in the older source | Steering samples | Interpretation                                                                                                                                        |
| ------------------------------ | ---------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phaser `batchSprite`           |  4,624 exclusive | Visible board submission is substantial; this does not justify a renderer rewrite or establish the physical-device raster cost.                       |
| `modalNavigation.topDialog`    |  2,443 inclusive | Repeated empty document scans; the pushed empty-result cache removes the demonstrated polling work.                                                   |
| `app.dialogOpen`               |  1,809 inclusive | A separate whole-document query remains; share presence knowledge with the existing modal owner while preserving ambiguous multiple-dialog detection. |
| `eventFeedback`                |  1,045 inclusive | Includes flight-information capture; investigate unnecessary projection independently of event handling.                                              |
| `flightInformation.finish`     |    925 inclusive | Reads a complete live snapshot merely to retrieve the completed batch; preserve event ownership and history while removing that redundant projection. |

## Change-only audio gains

Source inspection separately found `soundtrackPlayer.update → gains → Soundscape.configure → applyVolumes` on every callback. Even unchanged music volume scheduled all seven gain buses and cancelled/rescheduled three of them. This is a concrete redundant call path, not an attributed cause of the reported device stalls.

The player now compares the requested music gain with current settings before configuring it, and avoids unchanged unowned media-volume writes. Soundscape validates all configuration keys and values before returning unchanged settings without scheduling gains. Real volume changes, fades, attenuation leases, external setting reconciliation, mute and explicit lifecycle activation still apply through the existing owners. The master-media binding keeps its existing platform-specific ignored-volume handling.

Two regression controls fail against immutable pre-fix `1ccf8368a`. In 240 steady callbacks, the old player makes 240 configuration calls, 2,400 gain automation/cancellation calls and 240 media-volume assignments; the changed path makes zero of those redundant calls. The complete audio, player, gain-lease and both master groups pass **127/127**, with lint and formatting clean. These modeled call counts do not claim a measured device speedup. Evidence: `.cache/solo-followup/audio-steady-red-20261017/result.tap` and `.cache/solo-followup/audio-steady-gains-20261017.tap`.

## Completed flight-information observations

The host now retains the bridge's already-frozen completed warning and batch directly. It no longer requests a current board/actor projection merely to obtain those observations. Explicit Details/HUD readers still obtain a fresh live snapshot, and all batch sequencing, empty-batch publication, warning ownership, history limits, replacement and disposal rules remain intact. Validation translates failure text only when a check fails; all original checks and localized keys remain.

The new retention control fails before the change with 243 unnecessary snapshot requests across 240 empty ticks, one event batch and two notices; it passes with zero afterward. Explicit readers still report current pause state and preserve earlier immutable readings. The four complete source, bridge, host and Details-host files pass **51/51**. An independent review found no actionable issue.

The full run also exposed three stale host fixtures: they assumed an unwrapped save and compared raw engine events with the feedback director's enriched/coalesced audio cues. All three fail against immutable pre-fix `1ccf8368a`; corrected fixtures use the existing native-session reader and observe the accepted audio-batch boundary while invoking the real director. Those corrections pass against both versions. Original failures and red/green logs remain under `.cache/solo-followup/flight-retention-before-20261017/` and the adjacent `flight-retention-*.tap` files. They are not silently excluded from the test result.

## Browser work remains a separate measurement

These changes remove demonstrated application work; they do not establish a device timing pass. WebKit's Speedometer example explains why synchronous JavaScript timing alone can miss subsequent rendering work, and measures an additional rendering opportunity separately. The next matched runs must retain callback cadence and missed opportunities alongside application work; diagnostic profiles remain separate. Do not add extra per-frame timers to the production measurement or call an animation callback physical display completion. [WebKit measurement example](https://webkit.org/blog/15131/speedometer-3-0-the-best-way-yet-to-measure-browser-performance/).

## Actual canvas attributes and remaining copy cost

The retained Chromium 151.0.7922.34 CPU-control report observes `willReadFrequently: false`, `alpha: true` and sRGB on the detached board at both exported boundaries. The complete 637,093-byte report has SHA-256 `6bfe0da54e480387e91e89d77d6f48e63a38c49a78ca42a1864692138bc0ef2b`, inside the exact artifact identified above. These are observations for source `3adcd5379`, not assumptions about every browser or the current iPhone.

Inspection of the installed Phaser 4.2.1 source explains why reading its CanvasTexture constructor alone would be misleading: the CanvasPool smoothing setup creates the 2D context with `willReadFrequently: false` before the constructor's later request for `true`. The first established context retains its attributes. The displayed CanvasRenderer separately requests `false`. There is therefore no demonstrated incorrect readback hint to switch on this observed path; actual attributes remain part of native qualification. This does not prove hardware acceleration or explain all submission cost.

The profiled `batchSprite` path still copies the board into the displayed canvas. Avoiding that copy would change renderer ownership/submission; altering rounding, alpha or resolution can also change pixels. None is accepted solely from the sample count. Keep native cache/capture equality and whole-frame cadence measurements before proposing a rendering change.

WebKit's JetStream 3 example separately measures first iterations, worst iterations and sustained throughput, and describes how zero-valued coarse-clock measurements previously distorted results. Apply that lesson here by retaining startup, hitches and sustained windows, plus clock uncertainty, instead of using a fast isolated kernel as gameplay acceptance. Its engine benchmark results are not a measured speedup for this game. [WebKit's benchmark design](https://webkit.org/blog/17899/introducing-the-jetstream-3-benchmark-suite/).
