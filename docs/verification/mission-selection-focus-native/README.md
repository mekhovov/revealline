# Mission selection focus: native correction evidence

P03 scoped desktop verification against accepted source `595fdadddf3cf5c4240c430b78d27772915df83d`, with only `game/ui/mission-gallery.mjs` overridden. Final runtime SHA-256: `cc3f928980d3bd54d32f0a98a630855d5a185407afb0ab515cfd96a172795ed5` (6,583 bytes).

## Failure and correction

A real First Signal win (52.2%, 8,160 points, three lives) earns the card artwork. Clicking its nested picture/status label in Missions reproduces lost focus to BODY against unchanged accepted source. The first capture-only correction also loses focus for a native pointer click and Enter despite passing the original synchronous test harness; it was rejected.

The final correction captures the initiating card before mutation and finishes through a paired bubbling listener. Pointer activation on the nested status and Enter now both leave focus on the connected selected First Signal button with Deploy enabled. The visible focus border was inspected at 1280×720. Seven ordinary Tab presses reach Deploy; Enter closes Missions and starts a fresh 0% / three lives / zero-score flight with canvas focus. Escape pauses. Opening Missions then Escape returns to its actual opener and preserves the 0:05 pause; Resume remains explicit.

The modeled regression now permits microtask checkpoints between event-listener callbacks. This timing explanation is an inference consistent with the native failure and the [HTML cleanup algorithm](https://html.spec.whatwg.org/multipage/webappapis.html#clean-up-after-running-script), not timing instrumented inside the running game.

## Source and evidence

All served bytes were rehashed against exact Git objects or the pinned override: 371 bindings each for accepted baseline, rejected candidate and corrected candidate. See `binding-verification.json` and the three retained binding logs. `focus-observations.json` retains failures beside corrected observations. `journey.json` records actions and limits; local screenshot/AX/raw evidence hashes are in `local-artifact-pins.json`.

An initial corrected-candidate request was refused by the source server's capacity guard while disk free space was below 256 MiB. After coordinated cleanup, an ordinary reload succeeded. A wait for Main menu timed out during the real win celebration; visible Missions entry was used. Neither interruption is presented as a passing assertion or concealed product failure. The successfully loaded page reported no console warnings/errors.

## Limits and cleanup

This is native desktop pointer and keyboard evidence only. Modeled controller cases are separate; no physical Steam Deck/controller, touch, screen-reader, responsive, Large/Plain or zoom certification is claimed. No deployed release claim follows from local verification. Integration still must qualify the final source, publish immutable bytes and repeat relevant public journeys.

Test tab 182 was closed and server PID 96342 stopped. No viewport override was introduced. Root source, saves and release artifacts were not edited by this verification.

## Original artifact retention at integration

Every file in `local-artifact-pins.json` is retained byte-for-byte under `originals/`, including the screenshot, raw observations and executed server. Additional original baseline/rejected screenshots and observations are pinned by `failure-original-pins.json`. No original bytes were reformatted.
