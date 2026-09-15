# Reproducible native mixer check

Serve this source tree over HTTP and open [the check](index.html). Choose **Run signal check**. The page starts a short, quiet fixture through the edition's actual `Soundscape` and shared master modules. It reads no player storage and closes its own context on completion, Cancel or departure.

Two native oscillators enter the existing music/effects buses; an analyser observes the existing master/compressor output without replacing the destination route. Each phase settles for 0.2 audio seconds, then measures approximately 0.18 seconds. Overlapping analyser windows are not unique PCM sample counts. This follows the browser's [time-domain measurement API](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatTimeDomainData).

The [reviewed run](reviewed-signal.json) passes all six checks at 48 kHz:

| Check                   | Observed result       |
| ----------------------- | --------------------- |
| Initially muted         | RMS and peak zero     |
| Unmuted fixture present | RMS 0.007430757       |
| Master at one quarter   | RMS ratio 0.250056547 |
| Master at zero          | RMS and peak zero     |
| Restore full master     | RMS ratio 0.999610075 |
| Mute during playback    | RMS and peak zero     |

The owned context reports `closed` afterward. The [cancelled run](reviewed-cancel.json) correctly reports no successful measurement and confirms the same cleanup. Earlier reports are retained as historical harness iterations; [evidence.json](evidence.json) records their exact bytes and the final module pins.

Independent review identified a cancellation classification race at the last measurement boundary. The final harness checks ownership after the measurement loop and again after cleanup so Cancel cannot turn into a successful result. This changed the diagnostic harness only; the game mixer stayed byte-identical.

This is native **digital mixer** evidence. It does not prove physical speaker output, perceived quality, native MP3/video volume behavior, immediate acoustic mute latency, or complete release/device acceptance. The quiet fixture bypasses note composition and enters the two actual mixer buses directly. Actual song/video playback and their independent transport evidence remain in the parent verification directory.
