import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createNeutralPilotSession,
  advanceNeutralPilotSession,
  exportPilotObservations,
  verifyPilotObservations,
  pilotSessionEnded,
  MAX_PILOT_TICKS,
  MAX_PILOT_OBSERVATION_BYTES,
} from '../content-design/neutral-pilot-session.mjs';
import { verifyPilotFile } from '../../scripts/verify-pilot-observations.mjs';

for (const [mission, mode, directions] of [
  ['control-solo', 'solo', ['down']],
  ['uniqueness-pilot-horizon-race', 'versus', ['down', 'right']],
  ['control-team', 'team', ['down', 'down']],
]) {
  test(`${mode} observations replay real public inputs with distinct seat commands`, () => {
    const session = createNeutralPilotSession({ mission });
    const initial = structuredClone(session.configuration);
    const ticks = mode === 'team' ? 300 : 90;
    for (let tick = 0; tick < ticks; tick++) advanceNeutralPilotSession(session, directions);
    const record = exportPilotObservations(session, 'Opening only; not a full clear.');
    assert.deepEqual(
      record.configuration,
      initial,
      'Team runtime mutation cannot change source pins',
    );
    assert.deepEqual(record.segments, [{ ticks, directions }]);
    assert.equal(record.mode, mode);
    assert(record.outcome.states.every((state) => state.summary.tick === ticks));
    if (mode === 'versus')
      assert.notDeepEqual(record.outcome.states[0].players, record.outcome.states[1].players);
    if (mode === 'team') {
      assert(record.events.some((event) => event.type === 'cut.closed' && event.seat === 1));
      assert(record.events.some((event) => event.type === 'player.downed' && event.seat === 0));
      assert(record.events.some((event) => event.type === 'player.revived' && event.seat === 0));
    }
    const result = verifyPilotObservations(JSON.stringify(record));
    assert.equal(result.verified, true);
    assert.equal(result.terminal, false);
    assert(result.clears.every((cleared) => !cleared));
    const changed = structuredClone(record);
    changed.outcome.states[0].cells[0] = 99;
    assert.throws(() => verifyPilotObservations(changed), /outcome differs/);
  });
}

test('an actual complete control clear replays; forged events, truncated or extended routes fail', async () => {
  const session = createNeutralPilotSession({ mission: 'control-solo' });
  while (!pilotSessionEnded(session) && session.ticks < 1200)
    advanceNeutralPilotSession(session, ['down']);
  const record = exportPilotObservations(session);
  assert.equal(record.outcome.status, 'won');
  assert(record.events.some((event) => event.type === 'cut.closed'));
  const result = verifyPilotObservations(record);
  assert.equal(result.terminal, true);
  assert.deepEqual(result.clears, [true]);
  assert.throws(() => advanceNeutralPilotSession(session, ['down']), /already ended/);
  for (const [mutate, error] of [
    [
      (r) => {
        r.events = [];
      },
      /events differ/,
    ],
    [
      (r) => {
        r.ticks--;
        r.segments[0].ticks--;
      },
      /events differ|outcome differs/,
    ],
    [
      (r) => {
        r.ticks++;
        r.segments[0].ticks++;
      },
      /already ended/,
    ],
    [
      (r) => {
        r.configuration.sourceLevel.goal.coverage = 0.01;
      },
      /configuration differs/,
    ],
    [
      (r) => {
        r.mode = 'versus';
      },
      /Invalid pilot segment/,
    ],
    [
      (r) => {
        r.segments[0].directions[0] = 'teleport';
      },
      /Invalid pilot segment/,
    ],
    [
      (r) => {
        r.ticks = MAX_PILOT_TICKS + 1;
      },
      /tick count/,
    ],
    [
      (r) => {
        r.segments[0].ticks = MAX_PILOT_TICKS + 1;
      },
      /tick limit/,
    ],
    [
      (r) => {
        r.format = 'revealline-neutral-pilot-observations.v1';
      },
      /Unsupported/,
    ],
  ]) {
    const changed = structuredClone(record);
    mutate(changed);
    assert.throws(() => verifyPilotObservations(changed), error);
  }
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pilot-verification-'));
  try {
    const file = path.join(directory, 'observations.json');
    await fs.writeFile(file, JSON.stringify(record));
    assert.deepEqual(await verifyPilotFile(file), result);
    await fs.truncate(file, MAX_PILOT_OBSERVATION_BYTES + 1);
    await assert.rejects(verifyPilotFile(file), /file limit/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('difficulty/source identity and bounded recording cannot be bypassed by supplied outcomes', () => {
  assert.throws(
    () => createNeutralPilotSession({ mission: 'control-solo', difficulty: 'impossible' }),
    /difficulty/,
  );
  assert.throws(() => createNeutralPilotSession({ mission: 'control-solo', seed: -1 }), /seed/);
  const session = createNeutralPilotSession({
    mission: 'control-solo',
    difficulty: 'gentle',
    seed: 2,
  });
  const record = exportPilotObservations(session);
  assert.equal(verifyPilotObservations(record).terminal, false);
  const missingSeed = structuredClone(record);
  delete missingSeed.seed;
  assert.throws(() => verifyPilotObservations(missingSeed), /recording identity/);
  record.difficulty = 'expert';
  assert.throws(() => verifyPilotObservations(record), /configuration differs/);
  assert.throws(() => advanceNeutralPilotSession(session, ['down', 'up']), /directions/);
  assert.throws(() => exportPilotObservations(session, 'x'.repeat(8001)), /notes/);
  session.ticks = MAX_PILOT_TICKS;
  assert.throws(() => advanceNeutralPilotSession(session, [null]), /tick limit/);
});
