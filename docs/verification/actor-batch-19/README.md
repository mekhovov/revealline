# Existing Sentry practice qualification — batch 19

Parent: `0d7e0d28a6e928bc56f2b5960d02ad3233162633` (PR761).
Status: bounded source qualification; production review and public release deferred.

## Player journey covered

The existing **Sentry detour** greybox now has a complete actual Solo application
qualification under Standard, seed 1, with both supported turn policies. It uses
the original authored level, `rover-yard` theme, catalogue recipes and historical
legal-input routes. No runtime, mission, original artwork or release field changes.

Both cases admit the validated isolated practice scenario, start through its
existing control, drive real keyboard edges, pause on the first warning, resume,
win, export and verify the real recorded replay, retain the frozen result, and
Retry through a deliberate pointer gesture. Storage and handoff bytes stay intact;
practice grants no awards. The initial and Retry checkpoints match exactly.

| Route       | Original completion             | Observed counterplay                                                                                                                                                                                      |
| ----------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grid-center | 2,754 ticks; `c6b70bee5e553a14` | One locked warning and one fired shot; 204 exposed live-shot ticks; no loss or impact; capture removes the sentry at completion. Fired aim equals the earlier lock, and recovery does not erase the shot. |
| Immediate   | 5,202 ticks; `d84ab2551529735a` | Two warnings, no shots; one capture cancellation, then ram removal at tick 3,651. This route does not establish shot evasion or a second cancellation event.                                              |

Simulation identity remains `f548ecb05ac84109`. The test compares the real recorder's
expanded direction stream with every historical route command and verifies the
export through `verifyReplay`, including exact class, recipes, seed and steering.
The host and a separate core run agree at every recorded tick. No simulation
steps, actors, victories or checkpoint values are injected.

## Verification and corrected fixture

```sh
node --test game/test/sentry-practice-qualification.test.mjs
```

**2/2 passed**, zero failed/skipped/cancelled, 96,618.310208 ms, Node 22.22.2.
Scoped ESLint, Prettier, syntax and whitespace checks pass. Independent read-only
source review found no blocker. This is one complete test file, not an additional
whole-content or full-suite pass.

The first completed run passed Grid-center and failed Immediate because the test
held one keyboard gesture throughout each direct-core route segment. The host
correctly clears held movement on `capture.stopped`. The preserved recorder
diagnostic shows tick 2,203 requested Down in the historical route while the host
recorded a neutral direction after capture. This was a **fixture translation
error**, not evidence that the product's held-input safety was broken.

The corrected driver sends keyup followed by keydown after an observed capture
stop only when that segment still contains a recorded non-null direction. It
adds no frame or simulation tick. Original routes and checkpoint expectations
remain unchanged; the final exported direction stream must match them exactly.
Earlier interrupted runs are not passes or product-failure evidence.

`fixture-gesture-mismatch.tap.gz` and `recorder-gesture-diagnostic.tap.gz` retain
those completed diagnostic logs byte-for-byte. `manifest.json` records decoded
hashes as well as tested-source and receipt hashes. Use `gzip -dc` to read them.

## Scope and remaining work

The actual application logic uses modeled DOM, media, Canvas and keyboard/pointer
boundaries. This is deterministic host counterplay, pause, replay and Retry
evidence. It does not establish native pixels, physical-controller/touch behavior,
human fairness, all difficulties/seeds, full offline readiness or production
admission. Existing core-route and paired Versus proofs retain their separate
scope. No new encounter or mission is authored, and Team combat is not enabled.

The parallel Team slow-pickup cue fix is in PR757 at
`f09146837cfcc5191c89e54d7f9afea56b2ef8e9` with its own 70/70 focused cohort and
receipt. Those tests do not overlap this new file and do not qualify an integrated
build. Static edition collection was unavailable in that sparse checkout.

A/B/C source work remains the priority. Exact cohort binding/art/cultural review,
whole-roster adoption, integrated source/build/provenance, immutable publication,
public play and device checks remain open or deferred. C2's formal human benchmark
stays last. This batch introduces no version or publishing mutation.
