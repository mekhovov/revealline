import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { canonicalJSON, dataIdentity } from '../data-json.mjs';
import {
  NATIVE_PURSUIT_CATALOGUE,
  NATIVE_PURSUIT_V2_CATALOGUE,
  NATIVE_PURSUIT_PLAYLIST,
} from '../../optional-practice/civilian-fpv/native-pursuit-courses.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  recoverWorldFlight,
  replayWorldFlight,
  worldStateIdentity,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import { pursuitContactProtected } from '../../optional-practice/civilian-fpv/world-pursuit.mjs';

const root = new URL('./fixtures/native-pursuit-flight/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const controls = ['roll', 'pitch', 'yaw', 'throttle', 'actions'];
assert.equal(manifest.format, 'generated-native-pursuit-flight-routes.v1');
assert.deepEqual(manifest.playlist, NATIVE_PURSUIT_PLAYLIST);
assert.equal(manifest.generatorSha256, sha256(await readFile(new URL('generate.mjs', root))));
assert.deepEqual(
  manifest.courses.map((course) => ({ levelId: course.id, packIdentity: course.packIdentity })),
  NATIVE_PURSUIT_PLAYLIST.entries,
);

async function framesFor(route) {
  const bytes = await readFile(new URL(route.file, root));
  assert.equal(bytes.length, route.bytes);
  assert.equal(sha256(bytes), route.sha256);
  const [header, ...rows] = bytes.toString('utf8').trimEnd().split('\n');
  assert.equal(header, ['repeat', ...controls].join(','));
  const frames = [];
  for (const row of rows) {
    assert.match(row, /^\d+(?:,-?\d+){5}$/u);
    const [repeat, ...command] = row.split(',').map(Number);
    assert.ok(repeat > 0 && frames.length + repeat <= route.ticks);
    assert.ok(command.slice(0, 3).every((value) => Math.abs(value) <= 1000));
    assert.ok(command[3] >= 0 && command[3] <= 1000);
    assert.equal(command[4], 0, 'Pursuit completion uses contact, never weapons.');
    for (let tick = 0; tick < repeat; tick++) frames.push([...command]);
  }
  assert.equal(frames.length, route.ticks);
  assert.equal(dataIdentity(frames), route.inputIdentity);
  return frames;
}

// Software-generated existence witnesses. These fixed inputs do not adapt when
// rules change and do not establish human skill, device or artistic acceptance.
for (const specimen of manifest.courses) {
  assert.deepEqual(
    specimen.routes.map((route) => route.mode),
    ['self-level', 'acro'],
  );
  for (const route of specimen.routes)
    test(`${specimen.id} ${specimen.revision}/${route.mode}: pinned legal inputs complete and recover native pursuit`, async () => {
      const entry = [...NATIVE_PURSUIT_V2_CATALOGUE, ...NATIVE_PURSUIT_CATALOGUE].find(
        (candidate) =>
          candidate.id === specimen.id && candidate.packIdentity === specimen.packIdentity,
      );
      assert.ok(entry);
      const course = entry.course;
      assert.equal(course.revision, specimen.revision);
      assert.equal(course.rules.seed, specimen.seed);
      assert.equal(dataIdentity(course), specimen.recipeIdentity);
      assert.equal(sha256(canonicalJSON(course)), specimen.recipeSha256);
      const required = course.steps[route.mode][0].targets;
      const frames = await framesFor(route);
      const proof = { ...structuredClone(route.proof), frames };
      assert.equal(proof.format, 'FlightAttempt.v3');
      assert.equal(
        proof.model,
        course.pursuit.format === 'FlightPursuit.v2'
          ? 'civilian-world-pursuit.v2'
          : 'civilian-world-pursuit.v1',
      );
      await initWorldRuntime();
      const flight = createWorldFlight({ course, mode: route.mode });
      const recorder = createWorldRecorder(flight);
      let restored;
      const caught = [];
      const observed = new Set();
      flight.arm();
      try {
        for (const [index, frame] of frames.entries()) {
          const before = flight.snapshot();
          assert.equal(before.status, 'active', 'A route cannot append controls after completion.');
          for (const actor of before.actors)
            if (actor.pursuit) observed.add(`${actor.pursuit.family}:${actor.pursuit.phase}`);
          const input = Object.fromEntries(controls.map((key, column) => [key, frame[column]]));
          flight.step(input, { quantized: true });
          recorder.record();
          if (restored) {
            restored.flight.step(input, { quantized: true });
            restored.recorder.record();
          }
          const state = flight.snapshot();
          for (const event of state.events.filter((event) => event.type === 'catch')) {
            const actor = before.actors.find((candidate) => candidate.id === event.actor);
            assert.ok(actor?.pursuit);
            assert.equal(pursuitContactProtected(actor, before.position), false);
            if (actor.pursuit.family === 'brace-trooper')
              assert.equal(actor.pursuit.phase, 'recovering');
            caught.push(event.actor);
          }
          if (index + 1 === Math.floor(frames.length / 2)) {
            restored = await recoverWorldFlight(course, recorder.export());
            assert.equal(worldStateIdentity(restored.flight.snapshot()), worldStateIdentity(state));
            restored.flight.arm();
          }
        }
        const state = flight.snapshot();
        assert.equal(state.status, 'complete');
        assert.equal(state.ticks, route.ticks);
        assert.equal(state.health, 100);
        assert.equal(state.contacts, 0);
        assert.equal(state.shots, 0);
        assert.equal(state.hunt.failure, null);
        assert.deepEqual(state.hunt.caught, route.caught);
        assert.deepEqual(caught, route.caught);
        assert.deepEqual([...caught].sort(), [...required].sort());
        assert.equal(new Set(caught).size, caught.length, 'Each required target counts once.');
        assert.deepEqual(recorder.export(), proof);
        assert.deepEqual(restored.recorder.export(), proof);
        assert.equal(restored.flight.snapshot().status, 'complete');
        if (course.id.endsWith('runner-court')) assert.ok(observed.has('runner:flee'));
        if (course.id.endsWith('burst-lanes'))
          for (const phase of ['warning', 'burst', 'recovering'])
            assert.ok(observed.has(`sprinter:${phase}`));
        if (course.id.endsWith('refuge-return')) {
          assert.ok(observed.has('refuge-seeker:warning'));
          assert.ok(observed.has('refuge-seeker:committed'));
          assert.equal(
            state.actors.find((actor) => actor.id === 'pursuit-2').status,
            'active',
            'The optional courier is not required for completion.',
          );
        }
        if (course.id.endsWith('switchback-crossing'))
          assert.ok(observed.has('switchback:warning'));
        if (course.id.endsWith('meeting-yard')) assert.ok(observed.has('runner:flee'));
        if (course.id.endsWith('armor-windows'))
          for (const phase of ['warning', 'burst', 'recovering'])
            assert.ok(observed.has(`brace-trooper:${phase}`));
        const replay = await replayWorldFlight(course, proof);
        assert.equal(replay.state.status, 'complete');
        assert.equal(worldStateIdentity(replay.state), proof.finalStateIdentity);
      } finally {
        restored?.flight.dispose();
        flight.dispose();
      }
    });
}
