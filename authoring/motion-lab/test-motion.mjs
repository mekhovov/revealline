import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
import {advanceMotion, createMotionState, validatePresets} from "./motion.mjs";

const presets = JSON.parse(readFileSync(new URL("./presets.json", import.meta.url), "utf8"));
const input = changes => ({direction: null, boost: false, slow: false, autoplay: false, paused: false, reducedMotion: false, ...changes});
const advance = (state, control, dt, config = presets.motion) => advanceMotion(state, input(control), config, presets.board, presets.route, dt);
const near = (actual, expected, epsilon = 1e-7) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} differs from ${expected}`);

test("defaults are fixed 48×36, hybrid, and a compact 1.25-cell body", () => {
  validatePresets(presets);
  assert.deepEqual(presets.board, {columns: 48, rows: 36});
  assert.equal(presets.defaults.terrainStyle, "hybrid");
  assert.equal(presets.characters["fpv-body"].widthCells, 1.25);
  assert.equal(presets.characters["fpv-body"].heightCells, 1.25);
  assert.ok(existsSync(new URL(presets.characters["fpv-body"].src, import.meta.url)));
});

test("malformed terrain pitch and opacities fail before any render loop", () => {
  for (const pitch of [0, -1, NaN, Infinity, 0.1, 100]) {
    const edited = structuredClone(presets); edited.terrainStyles.hybrid.propPitch = pitch;
    assert.throws(() => validatePresets(edited), /propPitch/);
  }
  for (const opacity of [-0.1, 1.1, NaN, Infinity]) {
    const edited = structuredClone(presets); edited.terrainStyles.hybrid.microOpacity = opacity;
    assert.throws(() => validatePresets(edited), /opacities/);
  }
});

test("invalid geometry, short integration step and diagonal route fail visibly", () => {
  const resized = structuredClone(presets); resized.board.columns = 64;
  assert.throws(() => validatePresets(resized), /fixed 48/);
  const invalidStep = structuredClone(presets); invalidStep.motion.maxStepSeconds = 1e-100;
  assert.throws(() => validatePresets(invalidStep), /maxStepSeconds/);
  const diagonal = structuredClone(presets); diagonal.route[1].y += 1;
  assert.throws(() => validatePresets(diagonal), /orthogonal/);
});

test("cardinal direction and travel speed change immediately while facing lags", () => {
  const initial = createMotionState(presets.route);
  const moved = advance(initial, {direction: "down"}, 0.02, {...presets.motion, turnRateDegrees: 90});
  near(moved.x, initial.x);
  near(moved.y, initial.y + presets.motion.cruiseSpeed * 0.02);
  assert.equal(moved.speed, presets.motion.cruiseSpeed);
  assert.ok(moved.heading > 0 && moved.heading < Math.PI / 2);
  const left = advance(moved, {direction: "left"}, 0.02);
  near(left.y, moved.y);
  near(left.x, moved.x - presets.motion.cruiseSpeed * 0.02);
});

test("releasing movement stops immediately, with only visual response allowed to settle", () => {
  const moving = advance(createMotionState(presets.route), {direction: "right"}, 0.2);
  const stopped = advance(moving, {}, 0.05);
  assert.equal(stopped.speed, 0);
  assert.equal(stopped.x, moving.x);
  assert.equal(stopped.y, moving.y);
});

test("boost and slow change speed without steering", () => {
  const state = createMotionState(presets.route);
  const boost = advance(state, {direction: "right", boost: true}, 0.1);
  const slow = advance(state, {direction: "right", slow: true}, 0.1);
  near(boost.x - state.x, presets.motion.cruiseSpeed * presets.motion.boostMultiplier * 0.1);
  near(slow.x - state.x, presets.motion.cruiseSpeed * presets.motion.slowMultiplier * 0.1);
  assert.equal(boost.y, state.y); assert.equal(slow.y, state.y);
});

test("10, 20 and 60 fps preserve the same real-time manual travel", () => {
  for (const fps of [10, 20, 60]) {
    let state = createMotionState(presets.route);
    for (let frame = 0; frame < fps; frame++) state = advance(state, {direction: "right"}, 1 / fps);
    near(state.x, presets.route[0].x + presets.motion.cruiseSpeed);
    near(state.y, presets.route[0].y);
  }
});

test("autoplay carries distance through corners consistently across frame rates", () => {
  const results = [];
  for (const fps of [10, 20, 60]) {
    let state = createMotionState(presets.route);
    for (let frame = 0; frame < fps * 17; frame++) state = advance(state, {autoplay: true}, 1 / fps);
    results.push(state);
  }
  for (const state of results.slice(1)) {near(state.x, results[0].x); near(state.y, results[0].y);}
});

test("body turn rate and reduced motion cannot alter authoritative positions", () => {
  const results = [];
  for (const options of [{turnRateDegrees: 90, reducedMotion: false}, {turnRateDegrees: 720, reducedMotion: false}, {turnRateDegrees: 90, reducedMotion: true}]) {
    let state = createMotionState(presets.route);
    for (let frame = 0; frame < 240; frame++) {
      const direction = ["right", "down", "left", "up"][Math.floor(frame / 60)];
      state = advance(state, {direction, boost: frame % 60 < 10, reducedMotion: options.reducedMotion}, 1 / 60, {...presets.motion, turnRateDegrees: options.turnRateDegrees});
    }
    results.push(state);
  }
  for (const state of results.slice(1)) {near(state.x, results[0].x); near(state.y, results[0].y); assert.equal(state.speed, results[0].speed);}
  assert.equal(results[2].bank, 0);
  assert.equal(results[2].rotorPhase, 0);
});

test("pause preserves the complete presentation state and does not consume elapsed time", () => {
  const moving = advance(createMotionState(presets.route), {autoplay: true}, 0.2);
  const paused = advance(moving, {autoplay: true, paused: true, boost: true}, 30);
  assert.deepEqual(paused, moving);
});

test("true stalls cap catch-up, and board limits remain fixed", () => {
  const state = createMotionState(presets.route);
  const stalled = advance(state, {direction: "right"}, 10);
  near(stalled.x - state.x, presets.motion.cruiseSpeed * 0.25);
  const edge = advance({...state, x: 47.15}, {direction: "right"}, 0.1);
  assert.equal(edge.x, 47.2);
});

test("four palettes and three terrain treatments share the same footprint data", () => {
  assert.equal(Object.keys(presets.themes).length, 4);
  assert.deepEqual(Object.keys(presets.terrainStyles).sort(), ["hybrid", "microtile", "props"]);
  const footprints = JSON.stringify(presets.terrain);
  for (const theme of Object.keys(presets.themes)) for (const terrainStyle of Object.keys(presets.terrainStyles)) {
    const view = {...presets, defaults: {...presets.defaults, theme, terrainStyle}};
    validatePresets(view);
    assert.equal(JSON.stringify(view.terrain), footprints);
  }
});
