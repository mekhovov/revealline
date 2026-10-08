# Running-target contact audit

Observation date: 5 October 2026. Production runtime at base
`cfa30a228eb25d2bc7e4dd6d76e417c0d76a6873`; the working tree also contains presentation
and Free flight changes. This audit does not modify physics, courses, actor policies,
replay contracts or asset skins.

## Finding

A valid contact failing to catch an ordinary Contact Hunt target was **not reproduced**.
Actual flight inputs completed two authored moving-patrol courses and a native pursuit
course. All eight targets changed to `caught`; all three recorded attempts replayed to
the same final identity. This is a bounded runtime observation, not proof that every
course, skin, browser or physical controller works correctly.

There are 56 installed Hunt definitions: 30 have authored moving patrol paths and eight
have native pursuit policies. The remaining actors a player sees in the catalogue do
not all use the Hunt contract. Similar humanoid presentation across these activities
makes their different interaction rules insufficiently obvious.

| Activity                                              | Actual accepted interaction                                          | Why a visible actor can survive contact                                                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Contact Hunt                                          | Touch an eligible marked target. Catch sets its status to `caught`.  | Wrong ordered target, a protected pursuit actor, or an actor not in the objective. Pulse shots deliberately do not catch Hunt targets. |
| Combat, including `container-yard-05` and `garage-05` | Fire pulse shots at hostile targets until their health reaches zero. | Drone collision is solid contact, not melee damage.                                                                                    |
| Follow / Observe, including `adventure-orchard-04`    | Maintain the specified distance, view and tracking conditions.       | The subject is intentionally nondestructible. Contact is not the objective.                                                            |
| Other patrols / scenery                               | Background movement or decoration.                                   | Not every visible character is a target or even a gameplay actor.                                                                      |

Caught Hunt actors retain their old numeric health value because Hunt has a catch
contract, not health damage. `renderer.mjs` hides both `caught` and `defeated` status.
Reading health alone would incorrectly classify a successful Hunt catch as survival.

## Direct evidence

The following used the unmodified installed course definitions, default Gentle
self-level handling, the actual fixed-step flight integrator, Rapier collision,
production recorder and production replay. The approach controller below supplied
ordinary quantized commands; it did not teleport the drone or call the catch function.

| Authored course               | Catch ticks           | Final status            | Recorded final identity |
| ----------------------------- | --------------------- | ----------------------- | ----------------------- |
| `snake-hunt-chase-01`         | 503, 1174, 1834       | Complete; 3/3 caught    | `d943803169b6e957`      |
| `snake-hunt-chase-02`         | 727, 1305, 1794, 2425 | Complete; 4/4 caught    | `f6bd432f8afd9f8c`      |
| `native-pursuit-runner-court` | 407                   | Complete; runner caught | `c908b85310268624`      |

The approached target changed position on every simulated tick in all three runs.
The native course also contains a separate `field-machine` vehicle, which correctly
remained active because it is not the runner objective.

The existing evidence at
[`docs/evidence/sim-snake-hunt-flight-proofs.json`](evidence/sim-snake-hunt-flight-proofs.json)
was replayed again with the current production runtime. All four archived final
identities matched: all catches, deliberate echo-tail contact, pulses do not catch,
and wrong-order contact. Its original observation receipt is
[`docs/evidence/sim-snake-hunt-runtime-observation.json`](evidence/sim-snake-hunt-runtime-observation.json).

### Reproduce without a build or generated files

Run from the repository root. This command only reads repository files and writes
small result records to stdout; recordings remain in memory. It is functional
verification evidence, not newly claimed unit-test coverage.

```sh
node --input-type=module <<'JS'
import fs from 'node:fs';
import { WORLD_CATALOGUE } from './optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  initWorldRuntime, createWorldFlight, createWorldRecorder, replayWorldFlight,
} from './optional-practice/civilian-fpv/world-model.mjs';
import { responseCurve } from './optional-practice/civilian-fpv/radio-profile.mjs';

await initWorldRuntime();
const archived = JSON.parse(fs.readFileSync(
  'docs/evidence/sim-snake-hunt-flight-proofs.json', 'utf8',
));
for (const row of archived.flights) {
  const course = typeof row.course === 'object' ? row.course :
    WORLD_CATALOGUE.find(entry => entry.id === row.course).course;
  const { state } = await replayWorldFlight(course, row.proof);
  console.log(JSON.stringify({ kind: row.kind, status: state.status,
    ticks: state.ticks, caught: state.hunt.caught, exactReplay: true }));
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const unshape = output => {
  let input = 0;
  while (input < 1000 && responseCurve(input, 30) < Math.abs(output)) input++;
  return Math.sign(output) * input;
};
for (const id of ['snake-hunt-chase-01', 'snake-hunt-chase-02',
  'native-pursuit-runner-court']) {
  const course = WORLD_CATALOGUE.find(entry => entry.id === id).course;
  const flight = createWorldFlight({ course });
  try {
    const recorder = createWorldRecorder(flight);
    flight.arm();
    let state = flight.snapshot(), movingTicks = 0;
    const catches = [];
    for (let tick = 0; tick < 8000 && state.status === 'active'; tick++) {
      const target = state.actors.find(actor =>
        state.target.targets.includes(actor.id) && actor.status === 'active');
      if (!target) break;
      const destination = { ...target.position, y: 1000 }, acceleration = {};
      for (const axis of ['x', 'z']) {
        const velocity = clamp((destination[axis] - state.position[axis]) * 0.6,
          -2400, 2400);
        acceleration[axis] = clamp((velocity - state.velocity[axis]) * 2.4,
          -4000, 4000);
      }
      const roll = Math.atan2(acceleration.x, 9810) * 180 / Math.PI;
      const pitch = -Math.atan2(acceleration.z, 9810) * 180 / Math.PI;
      const vertical = clamp((destination.y - state.position.y) * 4 -
        state.velocity.y * 3, -6000, 7000);
      const command = {
        roll: unshape(roll / 30 * 1000), pitch: unshape(pitch / 30 * 1000),
        yaw: 0, actions: 0,
        throttle: Math.round(clamp((9810 + vertical) / 19620 /
          Math.max(0.65, state.attitude.up.y / 1000000) * 1000, 0, 1000)),
      };
      const before = target.position;
      state = flight.step(command, { quantized: true });
      recorder.record();
      const after = state.actors.find(actor => actor.id === target.id).position;
      if (after.x !== before.x || after.z !== before.z) movingTicks++;
      for (const event of state.events)
        if (event.type === 'catch') catches.push({ tick: state.ticks, ...event });
    }
    const proof = recorder.export();
    await replayWorldFlight(course, proof);
    console.log(JSON.stringify({ id, status: state.status, ticks: state.ticks,
      movingTicks, catches, finalIdentity: proof.finalStateIdentity,
      exactReplay: true, actors: state.actors.map(actor =>
        ({ id: actor.id, status: actor.status })) }));
  } finally {
    flight.dispose();
  }
}
JS
```

## Runtime and presentation trace

- `world-model.mjs`, `step()`: move actors, sweep the drone sphere against their
  previous-to-current positions, then pass eligible contacts to `catchHuntTarget`.
  Ordinary actors use solid collision and are not contact-damaged.
- `snake-hunt.mjs`, `catchHuntTarget()`: reject inactive, non-target and wrong-order
  actors. Successful catches set status, append evidence and emit a catch event.
- `world-pursuit.mjs`, `pursuitContactProtected()`: shield-bearers are protected
  from the front; brace-troopers are protected during warning and burst. Eligibility
  deliberately uses the accepted pre-tick facing and phase.
- `world-model.mjs`, `weapons()`: only eligible hostile actors receive pulse damage;
  Contact Hunt targets and couriers are excluded. This preserves the published
  contact-only rules and existing recordings.
- `renderer.mjs`, `updateActors()`: caught/defeated actors become invisible; ordered
  markers dim until they are next. Skin changes rebuild presentation but do not
  replace actor identity, radius or status.
- `world-app.mjs`: cards and direct Hunt links launch the selected exact catalogue
  entry. The active Hunt objective shows catch count, echo-tail length and ordered
  next number. No detected UI path transforms an ordinary Combat course into Hunt.

One relevant limitation: every moving-collider contact currently zeroes the drone's
velocity, including a valid catch. A successful catch can therefore feel like
hitting a wall for that tick. Changing this would change accepted replay outcomes;
it must be a separately versioned Hunt behavior if adopted, not a patch to old proofs.

## Recommended smallest next increment: make the contract visible

Implement a presentation-only interaction helper from the **active objective and
snapshot**, not merely the catalogue activity. Reuse it in the mission briefing and
compact active-target cue. This avoids misleading instructions after Combat advances
to landing or after a follow challenge changes phase.

| Context          | Suggested cue                                           | Inputs / state                                                         |
| ---------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Contact Hunt     | **Touch the marked target**; `01 → 02 → …` when ordered | Current Hunt criterion, caught IDs and ordered next ID                 |
| Combat           | **Fire a pulse** plus current Fire binding              | `eliminate` criterion, remaining target IDs and real input bindings    |
| Follow           | **Follow — keep your distance**                         | `actor-track-v1` with movement requirement and current range           |
| Observe          | **Observe — keep the subject in view**                  | Tracking criterion and existing tracking feedback                      |
| Protected shield | **Approach from the side or rear**                      | Actual `protected-contact` event and shield family                     |
| Protected brace  | **Wait for recovery, then touch**                       | Actual protection event and current pursuit phase                      |
| Ordered Hunt     | **Next target: 02**                                     | Existing ordered criterion, persistent while wrong targets are visible |

Keep objective numbers and labels visible; avoid relying on cyan versus amber alone.
Hunt currently shares the renderer's `friendly` cyan treatment with civilian/rival
markers, even though its gameplay actor role is hostile. A small explicit contact
symbol/label would distinguish the interaction without changing hitboxes or cast.

For ordered wrong-target feedback, the current runtime emits no actor-specific
contact event. Do not infer a definitive hit reason from proximity alone. Show the
required next target proactively; defer new actor-specific telemetry unless it can
be observer-only and demonstrably preserve state hashes. Protected contacts already
emit an authoritative event and can show a brief explanation immediately.

This increment should not add damage to civilian subjects, silently convert all
Combat into Hunt, alter health/collision/timing, change catch order, or promise that
all visible scenery can be destroyed. A later explicitly selected Hunt variant can
add additional eligible actors under its own content identity.

## Still unverified

No actual browser flight, live deployment, physical controller handling, all-skin
collision silhouette inspection, every Hunt course, or player acceptance was
performed in this audit. The user did not identify the exact failing course. Retain
that reported issue as unresolved beyond the bounded successful reproductions; the
interaction cue should improve diagnosis without claiming to fix an unobserved
physics failure.
