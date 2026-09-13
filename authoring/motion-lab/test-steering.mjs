import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createManualSteering} from "./steering.mjs";
import {advanceMotion, createMotionState} from "./motion.mjs";

const presets = JSON.parse(readFileSync(new URL("./presets.json", import.meta.url), "utf8"));
const controls = overrides => ({boost:false, slow:false, autoplay:false, paused:false, reducedMotion:false, ...overrides});

test("latest fresh key or pointer wins; release, repeats and an older hold cannot reclaim direction", () => {
  const steering = createManualSteering();
  assert.equal(steering.press("KeyD", "right"), true);
  assert.equal(steering.press("pointer-7", "down"), true);
  steering.release("pointer-7");
  assert.equal(steering.snapshot(), "down");
  assert.equal(steering.press("KeyD", "right"), false);
  assert.equal(steering.press("KeyD", "right", {repeat:true}), false);
  steering.release("KeyD");
  assert.equal(steering.press("KeyD", "right"), true);
  steering.release("KeyD");
  steering.press("KeyD", "right");
  assert.equal(steering.snapshot(), "right", "same direction never toggles movement off");
  assert.throws(() => steering.press("KeyA", "diagonal"), /direction/);
  assert.equal(steering.snapshot(), "right");
});

test("pause keeps unstepped intent, ignores inactive holds and reset requires a fresh press", () => {
  const steering = createManualSteering();
  steering.press("KeyD", "right");
  steering.clear({preserveDirection:true});
  assert.equal(steering.snapshot(), "right");
  assert.equal(steering.press("KeyS", "down", {active:false}), false);
  assert.equal(steering.press("KeyS", "down"), false);
  assert.equal(steering.snapshot(), "right");
  steering.clear();
  assert.equal(steering.snapshot(), null);
  assert.equal(steering.press("KeyD", "right"), false);
  steering.release("KeyD");
  assert.equal(steering.press("KeyD", "right"), true);
  steering.clear({preserveDirection:true, forgetPhysical:true});
  assert.equal(steering.press("KeyS", "down", {repeat:true}), false);
  assert.equal(steering.snapshot(), "right", "focus return cannot revive a repeating old key");
});

for (const turnPolicy of ["immediate", "grid-center"]) {
  test(`${turnPolicy}: real motion continues after release and explicit resume retains the complete turn`, () => {
    const config = {...presets.motion, turnPolicy};
    const steering = createManualSteering();
    const advance = (state, input, dt) => steering.advance(state, controls(input), config, presets.board, presets.route, dt);
    const initial = createMotionState(presets.route, config);
    steering.press("KeyD", "right");
    let state = advance(initial, {}, .04);
    steering.release("KeyD");
    const released = advance(state, {}, .02);
    assert.ok(released.x > state.x);
    state = released;
    steering.press("pointer-1", "down");
    state = advance(state, {}, .01);
    steering.release("pointer-1");
    if (turnPolicy === "grid-center") assert.equal(state.queuedDirection, "down");
    const frozen = structuredClone(state);
    steering.clear({preserveDirection:true});
    steering.press("KeyA", "left", {active:false});
    for (let i = 0; i < 10; i++) assert.equal(advance(state, {paused:true}, .25), state);
    assert.deepEqual(state, frozen);
    const resumed = advance(state, {}, .2);
    const expected = advanceMotion(frozen, controls({direction:"down"}), config, presets.board, presets.route, .2);
    assert.deepEqual(resumed, expected);
    assert.ok(resumed.y > state.y);
    assert.equal(resumed.direction, "down");
    assert.equal(resumed.queuedDirection ?? null, null);
    // A legacy caller still stops on null; the adapter has not changed that API.
    const legacyStopped = advanceMotion(resumed, controls({direction:null}), config, presets.board, presets.route, .1);
    assert.equal(legacyStopped.x, resumed.x);
    assert.equal(legacyStopped.y, resumed.y);
    assert.equal(legacyStopped.speed, 0);
  });

  test(`${turnPolicy}: explicit autoplay remains the same route and does not consume manual intent`, () => {
    const config = {...presets.motion, turnPolicy};
    const steering = createManualSteering();
    steering.press("KeyA", "left");
    const initial = createMotionState(presets.route, config);
    const input = controls({autoplay:true});
    const actual = steering.advance(initial, input, config, presets.board, presets.route, .2);
    const expected = advanceMotion(initial, {...input, direction:null}, config, presets.board, presets.route, .2);
    assert.deepEqual(actual, expected);
    assert.equal(steering.snapshot(), "left");
  });
}
