import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GYM_REPLAY_INPUTS,
  assertGymReplayImports,
  verifyFrozenGymTranscript,
} from './practice-exercise-replay.mjs';
import { createPractice } from '../optional-practice/civilian-flight/model.mjs';
import { CIVILIAN_PRACTICE_CATALOGUE } from '../optional-practice/civilian-flight/catalogue.mjs';

const files = async () =>
  new Map(await Promise.all(GYM_REPLAY_INPUTS.map(async (name) => [name, await readFile(name)])));
// Synthetic model commands are unit fixtures only, never browser evidence.
function traceFixture() {
  const model = createPractice(CIVILIAN_PRACTICE_CATALOGUE, 'lift-and-land');
  model.start();
  const commands = [];
  const command = (throttle, ticks) => {
    const input = { pitch: 0, roll: 0, yaw: 0, throttle };
    commands.push({ input, ticks });
    for (let i = 0; i < ticks; i++) model.step(input);
  };
  command(1, 20);
  command(0, 20);
  command(-1, 20);
  command(0, 19);
  assert.equal(model.snapshot().status, 'complete');
  return {
    format: 'revealline-practice-transcript.v1',
    catalogueIdentity: model.identity,
    drillId: 'lift-and-land',
    commands,
  };
}

test('independent replay requires completed lift-and-land and all frozen dependency bytes', async () => {
  const result = await verifyFrozenGymTranscript(await files(), JSON.stringify(traceFixture()));
  assert.equal(result.verified, true);
  assert.equal(result.qualified, false);
  assert.equal(result.inputs.length, 7);
  assert.equal(result.snapshot.checkpoint, 2);
});

test('rejects missing or changed replay dependencies', async () => {
  for (const name of GYM_REPLAY_INPUTS) {
    const missing = await files();
    missing.delete(name);
    await assert.rejects(verifyFrozenGymTranscript(missing, JSON.stringify(traceFixture())));
    const changed = await files();
    changed.set(name, Buffer.concat([changed.get(name), Buffer.from('\n')]));
    await assert.rejects(verifyFrozenGymTranscript(changed, JSON.stringify(traceFixture())));
  }
});

test('rejects incomplete, wrong-catalogue, extra-command and oversized transcripts', async () => {
  const fixture = traceFixture();
  for (const trace of [
    { ...fixture, commands: fixture.commands.slice(0, 2) },
    { ...fixture, catalogueIdentity: 'f'.repeat(16) },
    { ...fixture, drillId: 'another-drill' },
    { ...fixture, commands: [...fixture.commands, fixture.commands[0]] },
  ])
    await assert.rejects(verifyFrozenGymTranscript(await files(), JSON.stringify(trace)));
  await assert.rejects(verifyFrozenGymTranscript(await files(), ' '.repeat(131073)));
});

test('future unpinned static, dynamic, CommonJS and re-export dependencies fail closed', () => {
  for (const source of [
    "import './new-dependency.mjs';",
    "export { value } from './new-dependency.mjs';",
    "export * from './new-dependency.mjs';",
    "const load = () => import('./new-dependency.mjs');",
    "const load = () => require('./new-dependency.cjs');",
    "import fs from 'node:fs';",
  ])
    assert.throws(() =>
      assertGymReplayImports('optional-practice/civilian-flight/model.mjs', Buffer.from(source)),
    );
});
