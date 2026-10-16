import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJSON, dataIdentity } from '../data-json.mjs';
import {
  pursuitPilotCases,
  verifyPursuitPilotRecording,
} from '../../scripts/qualify-pursuit-pilots.mjs';
import {
  initWorldRuntime,
  createWorldFlight,
  createWorldRecorder,
  replayWorldFlight,
  worldStateIdentity,
} from '../../optional-practice/civilian-fpv/world-model.mjs';

const fixtureRoot = new URL('./fixtures/pursuit-pilot-flight/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', fixtureRoot), 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const controls = ['roll', 'pitch', 'yaw', 'throttle', 'actions'];
assert.equal(manifest.format, 'generated-pursuit-flight-routes.v1');
assert.deepEqual(
  manifest.routes.map((route) => route.mode),
  ['self-level', 'acro'],
);

async function recordedFrames(route) {
  const bytes = await readFile(new URL(route.file, fixtureRoot));
  assert.equal(bytes.length, route.bytes);
  assert.equal(sha256(bytes), route.sha256);
  const [header, ...rows] = bytes.toString('utf8').trimEnd().split('\n');
  assert.equal(header, ['repeat', ...controls].join(','));
  const frames = [];
  for (const row of rows) {
    assert.match(row, /^\d+(?:,-?\d+){5}$/u);
    const [repeat, ...command] = row.split(',').map(Number);
    assert.ok(repeat >= 1 && repeat <= route.ticks);
    assert.ok(command.slice(0, 3).every((value) => Math.abs(value) <= 1000));
    assert.ok(command[3] >= 0 && command[3] <= 1000);
    assert.equal(command[4], 0, 'The contact-only pilot never uses the fire action.');
    assert.ok(frames.length + repeat <= route.ticks);
    for (let i = 0; i < repeat; i++) frames.push([...command]);
  }
  assert.equal(frames.length, route.ticks);
  assert.equal(dataIdentity(frames), route.inputIdentity);
  return frames;
}

// These fixed inputs were generated through native controls, not human play.
// They prove two exact completion routes; other seeds and device/art review
// remain independent qualification gates.
for (const route of manifest.routes)
  test(`Low Pass Depot ${route.mode}: generated legal inputs complete the pinned native pilot`, async () => {
    const entry = pursuitPilotCases().find(
      (candidate) => candidate.pilot === manifest.pilot && candidate.mode === route.mode,
    );
    assert.equal(entry.family, 'sim');
    assert.equal(entry.seed, manifest.seed);
    assert.equal(dataIdentity(entry.level), manifest.recipeIdentity);
    assert.equal(sha256(canonicalJSON(entry.level)), manifest.recipeSha256);
    assert.equal(entry.level.rules.seed, 9601);
    assert.equal(entry.level.actors.length, 3);
    assert.ok(
      entry.level.actors.every(
        (actor) => actor.type === 'patrol' && actor.speed === 520 && actor.fireEveryTicks === 0,
      ),
    );
    const frames = await recordedFrames(route);
    const proof = { ...structuredClone(route.proof), frames };
    await initWorldRuntime();
    const flight = createWorldFlight({ course: entry.level, mode: route.mode });
    try {
      const recorder = createWorldRecorder(flight);
      flight.arm();
      for (const frame of frames) {
        assert.equal(flight.snapshot().status, 'active', 'No controls follow a terminal result.');
        flight.step(Object.fromEntries(controls.map((key, index) => [key, frame[index]])), {
          quantized: true,
        });
        recorder.record();
      }
      const state = flight.snapshot();
      assert.equal(state.status, 'complete');
      assert.equal(state.ticks, 1540);
      assert.deepEqual(state.hunt.caught, route.caught);
      assert.equal(state.actors.filter((actor) => actor.status === 'caught').length, 3);
      assert.ok(state.hunt.tail.length > 0);
      assert.equal(state.hunt.failure, null);
      assert.equal(state.health, route.health);
      assert.equal(state.contacts, route.contacts);
      assert.equal(state.shots, route.shots);
      assert.deepEqual(recorder.export(), proof);
      const replay = await replayWorldFlight(entry.level, proof);
      assert.equal(replay.state.status, 'complete');
      assert.equal(worldStateIdentity(replay.state), route.proof.finalStateIdentity);
      const receipt = await verifyPursuitPilotRecording({
        pilot: entry.pilot,
        mode: route.mode,
        pace: entry.pace,
        recording: proof,
      });
      assert.equal(receipt.verification, 'native-replay-completion');
      assert.equal(receipt.recipe.sha256, manifest.recipeSha256);
      assert.equal(receipt.outcome.status, 'complete');
      assert.equal(receipt.outcome.frames, 1540);
      assert.equal(receipt.humanPlay, 'pending');
      assert.equal(receipt.deviceAndAccessibility, 'pending');
      assert.equal(receipt.publicRelease, 'not-qualified');
    } finally {
      flight.dispose();
    }
  });
