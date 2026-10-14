# Shared fixed-step air transition

The regional authoring prototype, Academy and World Studio flight authorities now
call the same `advanceFlightAir` function in
`optional-practice/civilian-fpv/model.mjs`. The temporary copied force
implementation from #1220 is removed.

## Preserved contract

The extraction preserves integer expressions and rounding order, constants,
response shaping, angular response, quaternion integration, thrust, gravity,
drag and velocity limits. Independent axis bookkeeping is consolidated without
changing results. `FLIGHT_HZ` remains 50 and World Studio aliases
`WORLD_FLIGHT_HZ` to it so the hosts cannot silently diverge. The comparison
verifier explicitly requires both constants to remain 50. `FLIGHT_MODEL`
remains `civilian-quad-fixed.v1`; World model and proof identities are unchanged.

The helper accepts values already validated by its host. It mutates only angular
rate, orientation and velocity, writes integer movement into a caller-owned
displacement vector and returns the resulting attitude. It does not commit
position or increment time. Each production host still validates input, gates active/expired state, resolves
collisions/bounds, captures landing impact, evaluates objectives and owns
recordings/rewards exactly as before. The prototype calls the same helper on a
copied body and may reject that candidate while terrain is unavailable.

The helper lives inside the existing model module deliberately: no new runtime
asset, source-closure entry, decoder, package budget or cache resource is
introduced. The model module bytes change and must be included in the normal
subsequent player release; this work is not a new package qualification receipt.

## Verification

Existing Node v20.19.5 suites are run unchanged:

```sh
node --test --test-concurrency=2 \
  game/test/fpv-flight-model.test.mjs \
  game/test/fpv-flight-boundaries.test.mjs \
  game/test/fpv-cooperative-replay.test.mjs \
  game/test/fpv-replay-rate.test.mjs \
  game/test/fpv-radio.test.mjs \
  game/test/fpv-world-runtime.test.mjs
node authoring/fpv-worlds/regions/verify-air-transition.mjs
node authoring/fpv-worlds/regions/verify-flight-prototype.mjs \
  http://127.0.0.1:9011/region.json
```

All 51 existing tests passed. The additional before/after verifier compares
World Studio against its pre-extraction implementation at `98a6c41d1`: all 154
demonstrations, covering 312,948 ticks, retain identical complete replay states
and sampled paths. The proof identity digest is
`f31ab85d6090af4d9380f734bc535f67e2ce1a61ffd47e2521bffeb97f40f787`.

The golden boundary suite retains all 24 historical demonstration completion
hashes and the two 3,000-tick authority stress traces, including inverted
flight, yaw quadrants, gravity, grounded contact and bounds. Cooperative replay
retains the same complete states and sampled paths as synchronous replay. No
fixture expectations or proof bytes are updated to accommodate the extraction.

All seven regional checks passed and retain their original results: 2,196 accepted flat-terrain
ticks, four crossings, and exact world pose/momentum through each reframe;
actual Canyon sources produce 1,398 ticks and two crossings. Missing source,
rejected support, cancellation and ceiling policies remain separate from the
shared air transition.

These checks establish sampled/in-fixture equivalence, not cross-browser
performance, controller hardware or production regional collision qualification.

## Remaining

- Regional terrain still has a provisional conservative sphere-stop collision
  policy. Production collision/landing/damage contracts are not unified by this
  extraction.
- The real player renderer/input lifecycle and complete origin migration across
  all world owners remain separate work.
- Regional scenery, streaming recovery, device/memory/frame-time checks and
  player release qualification are still required. The authoring preview stays
  unscored, `playerReady:false` and absent from the player catalogue.
